var _ = require('underscore');
const fs = require('fs')
var db = {}
var give = {}
// [{ title: 'title1', d: 0, c: 'oipfjezojifze'}, { title: 'title2', d: 0, c: 'oipfjezojifze' }, { title: 'title3', d: 1, c: 'oipfjezojifze' }]

// Clean and persist every 3 hours
var CronJob = require('cron').CronJob;
var job = new CronJob('0 0 */3 * * *', function () {
    console.log("===== cycle ===== ")
    db.cycle()
}, null, true, 'America/Los_Angeles');

job.start();

const storeData = (data, path) => {
    try {
        fs.writeFileSync(path, JSON.stringify({ data: data }))
    } catch (err) {
        console.error(err)
        return (err.message)
    }
}

const loadData = (path) => {
    try {
        return JSON.parse(fs.readFileSync(path, 'utf8')).data
    } catch (err) {
        console.error(err)
        return (err.message)
    }
}

// Get from disk
db.backup = function backup() {
    console.log("===== backup ===== ")
    if (!global.listings || global.listings.length == 0) {
        global.listings = loadData('listings.json')
    }
    if (!global.listings || global.listings.length == 0) {
        global.listings = [{ title: 'title1', d: 0, desc: 'oipfjezojifze', pass: 'qub7s1ya', tags: ["tag1", "tag2"] }]
        db.persist()
    }
    global.listings.forEach(item => {
        Object.defineProperty(item, 'desc_', {
            get: function () { return (this.desc.toUpperCase()) }
        });
    });

}

// Set from disk
db.persist = function persist() {
    console.log("===== persist ===== ")
    storeData(global.listings, 'listings.json')
}

// Push item
db.push = function push(item) {
    console.log("===== push ===== ")
    var ids = _.pluck(global.listings, 'id')
    if (!item.id || ids.indexOf(item.id) >= 0)
        return ('item without id or id is already there.')
    Object.defineProperty(item, 'desc_', {
        get: function () { return (this.desc.toUpperCase()) }
    });
    global.listings.push(item)
}

// After some conditions persist
db.cycle = function cycle() {
    db.clean()
    db.persist()
    // db.backup()
}

// Purge deactivated items
db.clean = function clean() {
    console.log("===== clean ===== ")
    for (var i = 0; i < global.listings.length; i++) {
        if (global.listings[i].d) {
            global.listings.splice(i, 1);
        }
    }
}

// Get one
db.get = function get(query, subListing = global.listings) {
    console.log("===== get ===== ")
    return _.pick(_.findWhere(subListing, query), 'id', 'title', 'desc_')
}

// Deactivate one
db.deactivate = function deactivate(id, subListing = global.listings) {
    console.log("===== deactivate ===== ")
    return _.some(subListing, elem => {
        if (elem.id === id) {
            elem.d = 1;
            return true;
        }
    })
}


// Fetch some
// sanitize for desc key before fetch
db.fetch = function fetch(query, subListing = global.listings) {
    console.log("===== fetch ===== ")
    var isEmpty = _.isEmpty(_.filter(_.values(query), elem => { return elem }))

    if (isEmpty)
        return subListing
    return _.where(subListing, query)
}


// Reject some
// query ~= function(item){ return item.title != 'blablab'; }
// sanitize for desc key before reject
db.rejectDeep = function rejectDeep(key, value, subListing = global.listings) {
    console.log("===== rejectDeep ===== ")
    if (!value)
        return subListing
    var query = (item) => {
        return sanitizeHtml(item[key], {
            allowedTags: [],
            allowedAttributes: {}
        }).toLowerCase().indexOf(value.toLowerCase()) > -1;
    }
    return _.reject(subListing, query)
}

// query ~= function(item){ return item.title == 'blablab'; }
// sanitize for desc key before filter
db.fetchDeep = function fetchDeep(key, value, subListing = global.listings) {
    console.log("===== fetchDeep ===== ")
    if (!value)
        return subListing
    var query = (item) => {
        return sanitizeHtml(item[key], {
            allowedTags: [],
            allowedAttributes: {}
        }).toLowerCase().indexOf(value.toLowerCase()) > -1;
    }
    return _.filter(subListing, query)
}

// fuzzy search on all
const MiniSearch = require('minisearch')
let miniSearch = new MiniSearch({
    fields: ['title', 'description'], // fields to index for full-text search
    idFields: 'id',
    storeFields: ['id', 'title', 'd', 'desc_'], // fields to return with search results
    extractField: (document, fieldName) => {
        if (fieldName === 'description') {
            const desc = document['desc_']
            return desc && sanitizeHtml(desc, {
                allowedTags: [],
                allowedAttributes: {}
            })
        }
        return document[fieldName]
    }
})

db.fuzzy = function fuzzy(str) {
    if (miniSearch.documentCount === 0)
        miniSearch.addAll(global.listings)
    return miniSearch.search(str).map(entrie => { return _.pick(entrie, 'id', 'title', 'desc_', 'd') })
}

// Sort
db.sortBy = function sortBy(key, asc, subListing = global.listings) {
    console.log("===== sortBy ===== ")
    return asc ? _.sortBy(subListing, key) : _.sortBy(subListing, key).reverse()
}

db.paginate = function paginate(length, subListing = global.listings) {
    console.log("===== paginate ===== ")
    return _.chunk(subListing, length)
}

db.sinceDelta = function sinceDelta(minutes, subListing = global.listings) {
    console.log("===== since ===== ")
    var now = Math.floor(new Date().getTime() / 1000)
    var then = now - minutes
    var compare = (item) => { return item.id > then; }
    return _.filter(subListing, compare)
}

db.since = function since(then, subListing = global.listings) {
    console.log("===== since ===== ")
    var compare = (item) => { return item.id > then; }
    return _.filter(subListing, compare)
}

// Default limit to 100
db.toPublic = function toPublic(limit = 999998, subListing = global.listings) {
    if (limit == 999998)
        return _.map(subListing.filter(elem => { return !elem.deactivate }), entrie => { return _.pick(entrie, 'id', 'title', 'desc_') })
    else
        return _.map(subListing.filter(elem => { return !elem.deactivate }), entrie => { return _.pick(entrie, 'id', 'title', 'desc_') }).slice(0, limit)
}

const sanitizeHtml = require('sanitize-html');
give.sanitize = function sanitize(str) {
    const search1 = 'h1'
    const replacer1 = new RegExp(search1, 'g')
    const search2 = 'h2'
    const replacer2 = new RegExp(search2, 'g')
    str = str.replace(replacer1, 'h3').replace(replacer2, 'h4')
    return sanitizeHtml(str, {
        allowedTags: ['a', 'b', 'i', 'u', 'strike', 'ul', 'li', 'ol', 'pre', 'h3', 'h4', 'blockquote', 'hr', 'span', 'code'],
        allowedAttributes: {
            'span': ["style"],
            'a': ['href', 'name', 'target']
        },
        allowedStyles: {
            '*': {
                // Match HEX and RGB
                'color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/],
                'text-align': [/^left$/, /^right$/, /^center$/],
                // Match any number with px, em, or %
                'font-size': [/^\d+(?:px|em|%)$/]
            },
            'span': {
                'font-size': [/^\d+rem$/],
                'background-color': [/^pink$/]
            }
        }
    });
}
const path = require('path')

// const merge = require('deepmerge')
var file_content = fs.readFileSync(path.join(__dirname, 'taxonomy-with-ids.en-US.txt')).toString().replace(',', '_').split("\n").filter(elem => { return elem });

const splitBy = sep => str =>
    str.split(sep).map(x => x.trim());

const splitLine = splitBy('-');
const splitCategories = splitBy('>');

const nest = xs =>
    xs.length === 2
        ? typeof xs[1] === 'string'
            ? { [xs[0]]: { id: xs[1] } }
            : { [xs[0]]: nest(xs[1]) }
        : nest([xs[0], xs.slice(1)]);

const load = lines =>
    // put all lines into a "container"
    // we want to process all lines all the time as opposed to each line individually
    [lines]
        // separate id and categories
        // e.g ['3237', 'Animals & Pet Supplies > Live Animals']
        .map(lines => lines.map(splitLine))
        // split categories and put id last
        // e.g. ['Animals & Pet Supplies', 'Live Animals', 3237]
        .map(lines => lines.map(([id, cats]) => splitCategories(cats)))
        .pop();


give.googleTags = _.uniq(load(file_content).filter(arr => { return arr.length == 3 }), function (x) { return x.join(''); })

module.exports.db = db;
module.exports.give = give;
