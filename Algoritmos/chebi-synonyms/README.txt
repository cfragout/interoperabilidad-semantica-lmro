Agregar sinonimos a una ontologia existente.

Para correr el programa:

$ npm install

$ node --max-old-space-size=8192 index -t chebi.owl -i aptitud_principio-activo.json


Opciones:

-template, -t: archivo que contiene la ontologia.
-input, -i: el archivo grel de openRefine con los sinonimos que se van a agregar a la ontologia.
-output, -o: el nombre del archivo de salida.
