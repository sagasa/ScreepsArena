import { getObjectsByPrototype,getRange,findClosestByRange,createConstructionSite,findPath,getDirection,getTerrainAt,findInRange} from '/game/utils';
import { Creep, StructureSpawn ,StructureContainer,ConstructionSite,StructureTower,StructureRampart} from '/game/prototypes';
import {MOVE,ERR_NOT_ENOUGH_ENERGY ,RESOURCE_ENERGY,ERR_NOT_IN_RANGE,CARRY,ATTACK,RANGED_ATTACK,HEAL,WORK,TERRAIN_WALL,TERRAIN_SWAMP,TOUGH} from '/game/constants';
import {TOP,TOP_RIGHT,RIGHT,BOTTOM_RIGHT,BOTTOM,BOTTOM_LEFT,LEFT,TOP_LEFT} from '/game/constants';
import { } from '/arena';
import {CostMatrix,searchPath} from '/game/path-finder';

import {spawn_holder} from './utils';
import {canMove,check3x3,move,getDirection4,clamp1,entrySpawn,trySpawn} from './utils';
import * as ep from './info/enemies';
import * as cp from './info/creeps';
import * as workers from './creeps/workers';
import * as attackers from './creeps/attackers';
import * as maps from './info/maps';
import * as pf from './info/profiler';


let isInit


export function init(){

}

export function loop() {
    pf.start()

    if(!isInit){
        init();
        isInit=true;
    }
    
    cp.update()
    ep.update()
    maps.update()

    pf.lap('updateInfo','#FF8000')

    workers.update()
    pf.lap('updateWorkers','#00F000')
    attackers.update()
    
    pf.lap('updateAattackers','#F00000')

    trySpawn()
    
    pf.end()
}