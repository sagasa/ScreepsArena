import { } from '/game/utils';
import { } from '/game/prototypes';
import { } from '/game/constants';
import { } from '/arena';

import { getObjectsByPrototype } from '/game/utils';
import { Creep, Flag, StructureSpawn } from '/game/prototypes';
import { MOVE,ERR_NOT_ENOUGH_ENERGY } from '/game/constants';

var creep1, creep2;
  
export function loop() {
    var mySpawn = getObjectsByPrototype(StructureSpawn)[0];
    var flags = getObjectsByPrototype(Flag);

    if(!creep1) {
        creep1 = mySpawn.spawnCreep([MOVE]).object;
        console.log(creep1)
        if(creep1==ERR_NOT_ENOUGH_ENERGY)
                creep1=null;
    } else {
        creep1.moveTo(flags[0]);

         if(!creep2) {
            creep2 = mySpawn.spawnCreep([MOVE]).object;
            if(creep2==ERR_NOT_ENOUGH_ENERGY)
                creep2=null;
        } else {
            creep2.moveTo(flags[1]);
        }
    }
    
}