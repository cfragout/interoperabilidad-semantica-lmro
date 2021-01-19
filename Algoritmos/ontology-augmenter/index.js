// will be used to insert labels into the ontology (ontology is just a huge string)
String.prototype.splice = function(start, delCount, newSubStr) {
    return this.slice(0, start) + newSubStr + this.slice(start + Math.abs(delCount));
};

fs = require('fs');
commandLineArgs = require('command-line-args');

const INSERTION_POINT = '</rdf:RDF>' // insert before this tag
const RDF_TAG = '<rdf:RDF'

// program parameters
const optionDefinitions = [
  { name: 'ontology', alias: 't', type: String },
  { name: 'input', alias: 'i', type: String },
  { name: 'output', alias: 'o', type: String },
  { name: 'namespace', alias: 'n', type: String }
];


// available variables in the input template
const templateVariables = {
    '${{NAMESPACE_INDEX}}': () => getNamespaceIndex()
};


let namespaceIndex = 0;
const options = commandLineArgs(optionDefinitions);


const NAMESPACE = options.namespace || 'http://localhost/';
const ontologyPath = options.ontology || 'ontology.owl';

if (!options.input) {
    console.log('No se especifico archivo de entrada.');
    return;
}

// read files
const promises = [
    readFromFile(options.input),
    readFromFile(ontologyPath, 'utf8')
];

Promise.all(promises).then(result => {
    // input file containing new concepts and namespaces
    const inputFile = JSON.parse(result[0]);
    const concepts = inputFile.concepts;
    const namespaces = inputFile.namespaces;
    let ontology = result[1];
    let tagsCount = 0;
    let errorsCount = 0;

   
    if (ontology.indexOf(INSERTION_POINT) === -1) {
        // starting point not found
        console.log('No se encontro etiqueta <owl:Ontology>')
        return;
    }
    const insertAt = ontology.indexOf(INSERTION_POINT);

    // iterate through the namespaces
    namespaces && namespaces.forEach(namespace => {
        ontology = addNamespaceIfNotPresent(ontology, namespace);
    });

    // iterate through the content
    concepts && concepts.forEach(concept => {
        ontology = addNewConcept(ontology, concept, insertAt);
    });

    const resultFilePath = options.output || 'augmented-ontology.owl';
    // replace in ontology and write result
	fs.writeFile(resultFilePath, ontology, function (err,data) {
		if (err) {
			return console.log(err);
		}
		console.log(`Se creo el archivo ${resultFilePath}`);
	});
});



function addNewConcept(ontology, concept, insertAt) {
    // open concept tag
    let xml = `<${concept.namespace}:${concept.name}`;
    xml = addAttributes(xml, concept) + '>';

    if (concept.content) {
        concept.content.forEach(content => {
            xml += addNewConcept('', content, 0);
        });
    } else if(concept.value) {
        xml += getCompiledValue(concept.value);
    }

    // close concept tag
    xml += `</${concept.namespace}:${concept.name}>`;
    return ontology.splice(insertAt, 0, '\n\n' + xml + '\n\n'); 
}

function addAttributes(xml, concept) {
    if (concept.attributes) {
        concept.attributes.forEach(attr => {
            xml += ` ${attr.namespace}:${attr.name}="${getCompiledValue(attr.value)}"`
        });
        return xml;
    }

    return xml;
}

function getCompiledValue(rawValue) {
    return templateVariables[rawValue] ? templateVariables[rawValue]() : rawValue;
}

function getNamespaceIndex() {
    return NAMESPACE + namespaceIndex++;
}

function addNamespaceIfNotPresent(ontology, namespace) {
    if (ontology.indexOf(namespace) === -1) {
        const index = ontology.indexOf(RDF_TAG);
        return ontology.splice(index + RDF_TAG.length + 1, 0, namespace + ' ');
    }

    return ontology;
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
