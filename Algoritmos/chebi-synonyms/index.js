// will be used to insert labels into the ontology (ontology is just a huge string)
String.prototype.splice = function(start, delCount, newSubStr) {
    return this.slice(0, start) + newSubStr + this.slice(start + Math.abs(delCount));
};

fs = require('fs');
commandLineArgs = require('command-line-args');

const RECONCILED_CELL = 'core/recon-judge-similar-cells';
const SKOS_NAMESPACE = 'xmlns:skos="http://www.w3.org/2004/02/skos/core#"'
const RDF_TAG = '<rdf:RDF'

// program parameters
const optionDefinitions = [
  { name: 'ontology', alias: 't', type: String },
  { name: 'input', alias: 'i', type: String },
  { name: 'output', alias: 'o', type: String }
];

const options = commandLineArgs(optionDefinitions);


const ontologyPath = options.ontology || 'ontology.owl';

if (!options.input) {
    console.log('No se especifico archivo GREL de entrada.');
    return;
}

// read files
const promises = [
    readFromFile(options.input),
    readFromFile(ontologyPath, 'utf8')
];

Promise.all(promises).then(result => {
    // openRefine grel
    const grel = JSON.parse(result[0]);
    let ontology = result[1];
    let tagsCount = 0;
    let errorsCount = 0;

    if (ontology.indexOf(SKOS_NAMESPACE) === -1) {
        // add skos namespace
        ontology = addNamespace(ontology, SKOS_NAMESPACE);
    }

    // iterate through the content
    grel.forEach(element => {
        if (element.op === RECONCILED_CELL) {
            const modifiedOntology = insertLabelIntoOntology(ontology, element);
            if (modifiedOntology) {
                ontology = modifiedOntology;
                tagsCount++;
            } else {
                errorsCount++;
            }          
        }
    });

    const resultFilePath = options.output || 'modified-ontology.owl';
    // replace in ontology and write result
	fs.writeFile(resultFilePath, ontology, function (err,data) {
		if (err) {
			return console.log(err);
		}
        console.log(`\n\nSe agregaron ${tagsCount} sinonimos, ${errorsCount} errores.`);
		console.log(`Se creo el archivo ${resultFilePath}`);
	});
});

function addNamespace(ontology, namespace) {
    const index = ontology.indexOf(RDF_TAG);
    return ontology.splice(index + RDF_TAG.length + 1, 0, namespace + ' ');
}

function insertLabelIntoOntology(ontology, element) {
    const classTag = `<owl:Class rdf:about="${element.match.id}">`;
    // const classTag = `<owl:Class rdf:about="${element.match.id}">`;
    const label = getSynonymTagForElement(element);
    const index = ontology.indexOf(classTag);
    if (index > -1) {
        // insert label into ontology owl:class
        return ontology.splice(index  + classTag.length, 0, label);
    } 
    console.log(`No se encontro etiqueta para ${element.match.id} - ${element.match.name} en la ontologia.`)
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

// given an element from the GREL return a tag that represents a synonym in the ontology
function getSynonymTagForElement(element) {
    const synonymTag = '<skos:prefLabel>{{value}}</skos:prefLabel>';
    return '\n' + synonymTag.replace('{{value}}', element.similarValue) + '\n';
}

// returns the chebi id of a grel object
function getElementChebiId(element) {
    const id = element.match.id;
    const idIndex = id.indexOf('CHEBI_');
    return id.substring(idIndex);
}