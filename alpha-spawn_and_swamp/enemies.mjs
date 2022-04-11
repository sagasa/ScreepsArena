import { } from '/game/utils';
import {Creep} from '/game/prototypes';
import { } from '/game/constants';
import { } from '/arena';

import { getObjectsByPrototype } from '/game/utils';

class creep_profiler{

	constructor(){
		this.lastPos
		this.lastMoveTick
		this.moveSpeed
		this.weight
	}
}

let creeps=[]
let attacker=[]
let rangeAttacker=[]
let healer=[]
let worker=[]
let soldier=[]

export function update(){
	creeps=getObjectsByPrototype(Creep).filter(creep=>!creep.my&&creep.hits!=null)
}