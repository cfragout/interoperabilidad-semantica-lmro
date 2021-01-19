fs = require('fs');
xml2js = require('xml2js');
url = require('url');
commandLineArgs = require('command-line-args');


// program parameters
const optionDefinitions = [
  { name: 'agrovoc', alias: 'a', type: String },
  { name: 'namespace', alias: 'n', type: String },
  { name: 'unit', alias: 'u', type: String },
  { name: 'input', alias: 'i', type: String },
  { name: 'output', alias: 'o', type: String }
];
const options = commandLineArgs(optionDefinitions);

const AGROVOC_NAMESPACE = 'http://aims.fao.org/aos/agrovoc/';

const DATASET = options.input || 'dataset.rdf';
const OUTPUT = options.output || 'dataset-LMR-O.rdf';
const datasetNamespace = options.namespace || 'http://www.lifia.info.unlp.edu.ar/lmro/data/ar/';
const datasetUnit = options.unit || 'http://purl.obolibrary.org/obo/UO_0000308';

const _RECORD = 'Record';
const _ANY = 'Any';
const _EXCEMPT = 'Excempt';
const _RESIDUE_VALUE = 'ResidueValue';
const _CROP = 'Crop';

if (!options.agrovoc) {
    console.log('No se especificó archivo de AGROVOC');
    return;
}


var agrovocStr;
const newConcepts = [];
const conceptCache = [];


// read files
const promises = [
    readFromFile(DATASET),
    readFromFile(options.agrovoc, 'utf-8'),
];

logWithTime('***Start: ');


Promise.all(promises).then(result => {
    agrovocStr = result[1];
    const parser = new xml2js.Parser();
    const builder = new xml2js.Builder();
    const data = result[0];

    parser.parseString(data, function (err, result) {
        const rdfContent = result['rdf:RDF'];

        rdfContent['rdf:Description'].forEach(term => {
            if (isRecord(term)) {

                if (!term['lmro:role']) {
                    term['lmro:role'] = getAnyRoleConcept();
                }

                if (isNaN(term['lmro:maximumResidue'])) {
                    term['lmro:maximumResidue'] = getExcemptConcept();
                } else {
                    newConcepts.push(buildResidueValue(term));
                }

                if (!term['lmro:appliesTo']) {
                    term['lmro:appliesTo'] = getAnyRoleConcept();
                } else {
                    // builds the crop term
                    const crop = buildCrop(term);
                    if (crop) {
                        newConcepts.push(crop);
                    }
                }

            }
        });


        // adds the new concepts to the dataset
        rdfContent['rdf:Description'].push(...newConcepts);

        const xml = builder.buildObject(result);
        fs.writeFile(OUTPUT, xml, function (err,data) {
            if (err) {
                return console.log(err);
            }
            console.log(`Se creo el archivo ${OUTPUT}`);
        });
        logWithTime('***End: ');
    });
});


function logWithTime(str) {
    let date = new Date();
    console.log(str, date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds() + ':' + date.getMilliseconds());
}


function getWithLMRONamespace(str) {
    const lmroNamespace = 'http://www.lifia.info.unlp.edu.ar/lmro#';
    return lmroNamespace + str;
}

// builds the crop concept for an LMR Record
// we'll work the AGROVOC search as string since the XML parsing library cannot handle the AGROVOC rdf file size
function buildCrop(record) {
    // <rdf:Description rdf:about="http://www.lifia.info.unlp.edu.ar/lmro/data/ar/14/Crop">
    //     <rdf:type rdf:resource="http://www.lifia.info.unlp.edu.ar/lmro#Crop"/>
    //     <rdf:label>caña de azúcar (tallo fresco)</rdf:label>
    // </rdf:Description>
    // const value = record['lmro:appliesTo'][0]['$']['rdf:resource'];
    const value = record['lmro:appliesTo'][0];
    // crop has not been successfully reconcilled and is a string
    if (value.indexOf('http') === -1) {
        return;
    }



    if (!conceptCache[value]) {
        const agrovoc_description = `<rdf:Description rdf:about="${value}">`;
        const agrovoc_description_end = '</rdf:Description>';
        const agrovoc_notation = '<notation xmlns="http://www.w3.org/2004/02/skos/core#" rdf:datatype="http://aims.fao.org/aos/agrovoc/AgrovocCode">';
        const agrovoc_notation_end = '</notation>';
        let search = true;
        let startIndex = 0;
        let conceptId;
        while (search) {
            startIndex = agrovocStr.indexOf(agrovoc_description, 0 || startIndex);
            if (startIndex > -1) {
                const endIndex = agrovocStr.indexOf(agrovoc_description_end, startIndex) + agrovoc_description_end.length;
                const elem = agrovocStr.substring(startIndex, endIndex);
                    const notationIndex = elem.indexOf(agrovoc_notation);
                if (notationIndex > -1) {
                    conceptId = elem.substring(notationIndex + agrovoc_notation.length, elem.indexOf(agrovoc_notation_end))
                    search = false;
                } else {
                    // continue searching, this element is not the one we need
                    startIndex += 1;
                }
            } else {
                console.log('Elemento no encontrado en AGROVOC', value);
                search = false;
            }
        }

        if (conceptId) {
            const resourceIdentifier = record['$']['rdf:about'].split(datasetNamespace)[1];
            const cropUri = datasetNamespace + resourceIdentifier + '/' + _CROP;
            record['lmro:appliesTo'] = {'$':  { 'rdf:resource': cropUri }};

            // only add crops once to the dataset
            conceptCache[value] = cropUri;

            return {
                '$':  { 'rdf:about': cropUri },
                'rdf:type': [
                    {
                        '$':  { 'rdf:resource': getWithLMRONamespace(_CROP) }
                    }
                ],
                'schema:sameAs': [
                    {
                        '$': { 'rdf:resource': asAGROVOCConcept(conceptId) }
                    }
                ],
                'rdf:label': [
                    {
                        '$': { 'rdf:resource': value }
                    }
                ]
            };


        }
    }


    
    record['lmro:appliesTo'] = {'$':  { 'rdf:resource': conceptCache[value] }};
    return '';
}

// builds the residue value concept for an LMR Record
function buildResidueValue(record) {
    // <rdf:Description rdf:about="http://www.lifia.info.unlp.edu.ar/lmro/data/ar/13/ResidueValue">
    //     <rdf:type rdf:resource="http://www.lifia.info.unlp.edu.ar/lmro#ResidueValue"/>
    //     <lmro:hasValue rdf:datatype="http://www.w3.org/2001/XMLSchema#float">20</lmro:hasValue>
    //     <lmro:hasUnit rdf:resource="http://purl.obolibrary.org/obo/UO_0000308"/>
    // </rdf:Description>
    const value = record['lmro:maximumResidue'];
    const resourceIdentifier = record['$']['rdf:about'].split(datasetNamespace)[1];
    const residueValueUri = datasetNamespace + resourceIdentifier + '/' + _RESIDUE_VALUE;
    record['lmro:maximumResidue'] = {'$':  { 'rdf:resource': residueValueUri }};

    return {
        '$':  { 'rdf:about': residueValueUri },
        'rdf:type': [
            {
                '$':  { 'rdf:resource': getWithLMRONamespace(_RESIDUE_VALUE) }
            }
        ],
        'lmro:hasValue': [
            {
                '$': { 'rdf:datatype': 'http://www.w3.org/2001/XMLSchema#float' },
                '_': value.toString()
            }
        ],
        'lmro:hasUnit': [
            {                
                '$': { 'rdf:resource': datasetUnit }
            }
        ]
    };
}

// lmro#record
function isRecord(term) {
    return term['rdf:type'][0]['$']['rdf:resource'] === getWithLMRONamespace(_RECORD);
}

// returns lmro#Any
function getAnyRoleConcept() {
    return {'$': { 'rdf:resource': getWithLMRONamespace(_ANY) }}
}

// return lmro#Excempt
function getExcemptConcept() {
    return {'$': { 'rdf:resource': getWithLMRONamespace(_EXCEMPT) }}
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

function asAGROVOCConcept(id) {
    const conceptPrefix = 'c_';
    return AGROVOC_NAMESPACE + conceptPrefix + id;
}