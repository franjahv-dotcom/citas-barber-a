import fs from 'node:fs/promises';
import {FileBlob,PresentationFile} from '@oai/artifact-tool';
const p=await PresentationFile.importPptx(await FileBlob.load('output/presentacion/Presentacion_segunda_entrega_barberia.pptx'));
for(let i=0;i<p.slides.items.length;i++){const b=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(`tmp/presentacion/final-${i+1}.png`,new Uint8Array(await b.arrayBuffer()));}
console.log(p.slides.items.length);
