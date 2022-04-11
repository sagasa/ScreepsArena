//import { getTicks } from '/game/utils';
//import { } from '/game/prototypes';
import { } from '/game/constants';
import { } from '/arena';
import { getObjectsByPrototype } from '/game/utils';
import { Creep,Flag } from '/game/prototypes';

export function loop() {
    // Your code goes here
    var creeps = getObjectsByPrototype(Creep);
    var flags=getObjectsByPrototype(Flag);
    console.log('Current tick:', flags[0]);

    creeps[0].moveTo(flags[0]);
}
