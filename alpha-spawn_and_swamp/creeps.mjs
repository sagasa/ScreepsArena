import {getObjectsByPrototype} from '/game/utils';
import {Creep,StructureSpawn,OwnedStructure} from '/game/prototypes';
import {ATTACK,RANGED_ATTACK,HEAL} from '/game/constants';
import { } from '/arena';


export let creeps
export let ownedStructures

export function update(){
	creeps = getObjectsByPrototype(Creep).filter(creep=>creep.my)
	ownedStructures = getObjectsByPrototype(OwnedStructure)
}