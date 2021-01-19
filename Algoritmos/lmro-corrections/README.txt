Termina la generación del dataset LMR-O que comienza con la exportación de tripletas RDF desde OpenRefine

Para correr el programa:

$ npm install

$ node --max-old-space-size=9216 index -a agrovoc.rdf -i dataset-ar.rdf -n http://www.lifia.info.unlp.edu.ar/lmro/data/ar/


Opciones:

-agrovoc, -a: archivo de AGROVOC que se utilizará para obtener información de cultivos.
-unit, -u: URI de la unidad de medida que se utilizará en el dataset.
-namespace, -n: namespace que se utilizará en el dataset
-input, -i: el archivo rdf que contiene el dataset.
-output, -o: el nombre del archivo de salida.

