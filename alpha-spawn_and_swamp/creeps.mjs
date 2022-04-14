import {getObjectsByPrototype} from '/game/utils';
import {Creep,StructureSpawn,OwnedStructure} from '/game/prototypes';
import {ATTACK,RANGED_ATTACK,HEAL} from '/game/constants';
import { } from '/arena';


export let myCreeps
export let ownedStructures

export function update(){
	myCreeps = getObjectsByPrototype(Creep).filter(creep=>creep.my)
	ownedStructures = getObjectsByPrototype(OwnedStructure)
}