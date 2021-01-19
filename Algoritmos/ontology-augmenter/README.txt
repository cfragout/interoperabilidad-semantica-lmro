Agregar conceptos a una ontologia existente.

Para correr el programa:

$ npm install

$ node --max-old-space-size=9216 index -t chebi.owl -i principios-activos.json -n "www.lifia.info.unlp.edu.ar/data/lmro/"


Opciones:

-template, -t: archivo que contiene la ontologia.
-input, -i: el archivo grel de openRefine con los sinonimos que se van a agregar a la ontologia.
-output, -o: el nombre del archivo de salida.
-namespace, -n: namespace uri
