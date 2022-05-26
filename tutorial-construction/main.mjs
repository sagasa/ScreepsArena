import { prototypes, utils } from '/game';
import { RESOURCE_ENERGY, ERR_NOT_IN_RANGE } from '/game/constants';

let isInit = false
function init(){
    creep = utils.getObjectsByPrototype(prototypes.Creep).find(i => i.my)
    container = utils.findClosestByPath(creep, utils.getObjectsByPrototype(prototypes.StructureContainer))
    utils.createConstructionSite(54,48, prototypes.StructureRampart)
    //utils.createConstructionSite(54,49, prototypes.StructureRampart)
    utils.createConstructionSite(54,48, prototypes.StructureContainer)
    //construction = utils.createConstructionSite(54,48, prototypes.StructureTower).object
}

let creep
let container
let construction

export function loop() {
    if(!isInit){
        init()
        isInit = true
    }
    construction = utils.getObjectsByPrototype(prototypes.ConstructionSite).find(i => i.my);
    console.log(construction)
    if(creep.store[RESOURCE_ENERGY]<50){
        if(creep.withdraw(container, RESOURCE_ENERGY,30) == ERR_NOT_IN_RANGE) {
            creep.moveTo(container);
        }
    }
    if(creep.build(construction) == ERR_NOT_IN_RANGE) {
        creep.moveTo(construction);
    }
}