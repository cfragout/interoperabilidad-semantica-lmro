fs = require('fs');
xml2js = require('xml2js');
commandLineArgs = require('command-line-args');


// program parameters
const optionDefinitions = [
  { name: 'input', alias: 'i', type: String },
  { name: 'output', alias: 'o', type: String },
  { name: 'provenance', alias: 'p', type: String }
];
const options = commandLineArgs(optionDefinitions);

const lmroNamespace = 'http://www.lifia.info.unlp.edu.ar/lmro#';
const DATASET = options.input || 'dataset.rdf';
const PROVENANCE = options.provenance || 'provenance.json';
const OUTPUT = options.output || 'dataset-with-provenance.rdf';

const _PUBLICATION_ACTIVITY = 'PublicationActivity';
const _RESIDUE_VALUE = 'ResidueValue';
const _CROP = 'Crop';
const _ORGANIZATION = 'Organization';
const _PUBLICATION = 'Publication';
const _SOURCE_DOCUMENT = 'SourceDocument';
const _PUBLISHER = 'Publisher';


let namespace = 'http://localhost/';


// read files
const promises = [
    readFromFile(DATASET),
    readFromFile(PROVENANCE, 'utf-8'),
];

Promise.all(promises).then(result => {
    const parser = new xml2js.Parser();
    const builder = new xml2js.Builder();
    const data = result[0];
    const provenance = result[1] ? JSON.parse(result[1]) : {};

    namespace = provenance.namespace || namespace;

    parser.parseString(data, function (err, result) {
        const rdfContent = result['rdf:RDF'];

        rdfContent['$']['xmlns:prov'] = 'http://www.w3.org/ns/prov#';
        rdfContent['$']['xmlns:schema'] = 'http://schema.org/';
        rdfContent['$']['xmlns:dc'] = 'http://purl.org/dc/elements/1.1/';

        const publicationActivity = buildPublicationActivity();
        const organization = buildOrganization(provenance.sourceDocument);
        const sourceDocument = buildSourceDocument(provenance.sourceDocument);
        const publishingOrganization = buildPublishingOrganization(provenance.publisher);
        const publication = buildPublication();

        // iterate each of the terms, these represet a row in the original table
        rdfContent['rdf:Description'].forEach(term => {
            if (isRecord(term) || isResidueValue(term) || isCrop(term)) {
                term['schema:isPartOf'] = {
                    '$': {
                        'rdf:resource': getWithNamespace(_PUBLICATION)
                    }
                }
            }
        });


        publicationActivity['prov:endedAtTime'] = [
            {
                '$': {
                    'rdf:datatype': 'http://www.w3.org/2001/XMLSchema#dateTime'
                },
                '_': new Date().toISOString()
            }
        ];

        rdfContent['rdf:Description'].push(publicationActivity);
        rdfContent['rdf:Description'].push(organization);
        rdfContent['rdf:Description'].push(publishingOrganization);
        rdfContent['rdf:Description'].push(publication);
        rdfContent['rdf:Description'].push(sourceDocument);


        const xml = builder.buildObject(result);
        fs.writeFile(OUTPUT, xml, function (err,data) {
            if (err) {
                return console.log(err);
            }
            console.log(`Se creo el archivo ${OUTPUT}`);
        });
    });
});

function buildSourceDocument(source) {
    if (!source) {
        console.log('No hay informacion de dataset original')
        return;
    }

    const sourceDocument = {
        '$':  { 'rdf:about': getWithNamespace(_SOURCE_DOCUMENT) },
        'rdf:type': [
            {
                '$':  { 'rdf:resource': lmroNamespace + _SOURCE_DOCUMENT }
            }
        ]
    };

    if (source.createdBy && source.createdBy.uri) {
        sourceDocument['dc:creator'] = {
                    '$': {
                        'rdf:resource': getWithNamespace(_ORGANIZATION)
                    }
                }
    }

    if (source.date) {
        sourceDocument['dc:date'] = source.date;
    }

    if (source.format) {
        sourceDocument['dc:format'] = source.format;
    }

    if (source.language) {
        sourceDocument['dc:language'] = source.language;
    }

    if (source.description) {
        sourceDocument['dc:description'] = source.description;
    }

    if (source.title) {
        sourceDocument['dc:title'] = source.title;
    }

    if (source.identifier) {
        sourceDocument['dc:identifier'] = source.identifier;
    }

// creator http://purl.org/dc/elements/1.1/creator
//  date:   http://purl.org/dc/elements/1.1/date
// format: http://purl.org/dc/elements/1.1/format
//  Language    http://purl.org/dc/elements/1.1/language
//  Description http://purl.org/dc/terms/description
//  Title http://purl.org/dc/terms/title
// identifier http://purl.org/dc/terms/identifier

    return sourceDocument;
}

function buildOrganization(source) {
    if (!source.createdBy) {
        console.log('No hay informacion de publicador original')
        return;
    }

    const organization = {
        '$':  { 'rdf:about': getWithNamespace(_ORGANIZATION) },
        'rdf:type': [
            {
                '$':  { 'rdf:resource': 'http://www.w3.org/ns/prov#Organization' }
            }
        ],
        'rdf:label': source.createdBy.name
    };

    if (source.createdBy.uri) {
        organization['schema:sameAs'] = [
            {
                '$':  { 'rdf:resource': source.createdBy.uri }
            }
        ];
    }

    return organization;
}

function buildPublishingOrganization(org) {
    if (!org) {
        console.log('No hay informacion de publicador')
        return;
    }

    const organization = {
        '$':  { 'rdf:about': getWithNamespace(_PUBLISHER) },
        'rdf:type': [
            {
                '$':  { 'rdf:resource': 'http://www.w3.org/ns/prov#Organization' }
            }
        ],
        'rdf:label': org.name
    };

    if (org.uri) {
        organization['schema:sameAs'] = [
            {
                '$':  { 'rdf:resource': org.uri }
            }
        ];
    }

    return organization;
}

function buildPublicationActivity() {
    return {
        '$':  { 'rdf:about': getWithNamespace(_PUBLICATION_ACTIVITY) },
        'rdf:type': [
            {
                '$':  { 'rdf:resource': lmroNamespace + _PUBLICATION_ACTIVITY }
            }
        ],
        'prov:wasAssociatedWith': [
            {
                '$': { 'rdf:resource': getWithNamespace(_PUBLISHER) }
            }
        ],
        'prov:startedAtTime': [
            {                
                '$': { 'rdf:datatype': 'http://www.w3.org/2001/XMLSchema#dateTime' },
                '_': new Date().toISOString()
            }
        ],
        'prov:used': [
            {                
                '$': { 'rdf:resource': getWithNamespace(_SOURCE_DOCUMENT) }
            }
        ]
    };
}

function buildPublication() {
   return {
        '$':  { 'rdf:about': getWithNamespace(_PUBLICATION) },
        'rdf:type': [
            {
                '$':  { 'rdf:resource': lmroNamespace + _PUBLICATION }
            }
        ],
        'prov:wasDerivedFrom': [
            {
                '$': { 'rdf:resource': getWithNamespace(_SOURCE_DOCUMENT) }
            }
        ],
        'prov:wasGeneratedBy': [
            {                
                '$': { 'rdf:resource': getWithNamespace(_PUBLICATION_ACTIVITY) }
            }
        ],
        'prov:wasAttributedTo': [
            {                
                '$': { 'rdf:resource': getWithNamespace(_PUBLISHER) }
            }
        ]
    }; 
}

// lmro#publicationActivity
function isPublicationActivity(term) {
    return term['$']['rdf:about'].indexOf('/' + _PUBLICATION_ACTIVITY) > -1;
}

// lmro#residueValue
function isResidueValue(term) {
    return term['$']['rdf:about'].indexOf('/' + _RESIDUE_VALUE) > -1;
}

// lmro#crop
function isCrop(term) {
    return term['$']['rdf:about'].indexOf('/' + _CROP) > -1;
}

// lmro#record
function isRecord(term) {
    return term['$']['rdf:about'].indexOf('/' + _ORGANIZATION) === -1 &&
            term['$']['rdf:about'].indexOf('/' + _RESIDUE_VALUE) === -1 &&
            term['$']['rdf:about'].indexOf('/' + _CROP) === -1 &&
            term['$']['rdf:about'].indexOf('/' + _PUBLICATION_ACTIVITY) === -1;    
}

function readFromFile(file, format = '') {
    return new Promise((resolve, reject) => {
        fs.readFile(file, format, function (err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

function getWithNamespace(str) {
    return namespace + str;
}