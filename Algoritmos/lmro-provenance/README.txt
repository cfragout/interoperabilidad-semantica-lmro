Agrega informacion de proveniencia al conjunto de datos de LMRO.

Para correr el programa:

$ npm install

$ node --max-old-space-size=9216 index -p provenance.json -i dataset.rdf -o dataset-with-provenance.rdf


Opciones:

-provenance, -p: el archivo con la informacion de provenance.
-input, -i: el archivo rdf que contiene el dataset.
-output, -o: el nombre del archivo de salida.

