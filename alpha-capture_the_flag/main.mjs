import { } from '/game/utils';
import { } from '/game/prototypes';
import { } from '/game/constants';
import { } from '/arena';

import { getObjectsByPrototype } from 'game/utils';
import { Creep } from 'game/prototypes';
import { Flag } from 'arena/season_alpha/capture_the_flag/basic';

let attackers = []
let rangedAttackers = []

export function loop() {
    var enemyFlag = getObjectsByPrototype(Flag).find(object => !object.my);
    var myCreeps = getObjectsByPrototype(Creep).filter(object => object.my);
    for(var creep of myCreeps) {
        creep.moveTo(enemyFlag);
    }
}
