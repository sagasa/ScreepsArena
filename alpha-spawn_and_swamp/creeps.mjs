import { getObjectsByPrototype,getRange,findClosestByRange,createConstructionSite,findPath,getDirection,getTerrainAt,findInRange,getTicks} from '/game/utils';
import { Creep, StructureSpawn ,StructureContainer,ConstructionSite,StructureTower,StructureRampart,OwnedStructure,StructureExtension} from '/game/prototypes';
import {MOVE,ERR_NOT_ENOUGH_ENERGY ,RESOURCE_ENERGY,ERR_NOT_IN_RANGE,CARRY,ATTACK,RANGED_ATTACK,HEAL,WORK,TERRAIN_WALL,TERRAIN_SWAMP} from '/game/constants';
import {TOP,TOP_RIGHT,RIGHT,BOTTOM_RIGHT,BOTTOM,BOTTOM_LEFT,LEFT,TOP_LEFT} from '/game/constants';
import { } from '/arena';
import {CostMatrix,searchPath} from '/game/path-finder';

import {canMove,check3x3,move,getDirection4,clamp1} from './utils';

export class creep_holder{
    constructor(creep) {
        this.creep = creep;
    }
    canMove(){
        return this.creep.fatigue<=0;
    }
    isDead(){
        return this.creep.hits==null;
    }
}

export class spawn_holder{
    constructor(spawn) {
        this.spawn = spawn;
        this.progress = null
    }

    trySpawn(body){
        if(this.progress!=null){
            if(this.progress.id==null||getRange(this.spawn, this.progress)==0)
                return null
            else
                this.progress = null
        }
        let res = this.spawn.spawnCreep(body)
        if(res.object==null)
            return null
        
        this.progress = res.object
        return this.progress
    }
}

let containeRresources
let neutralContaineResources
let extensions

let myCreeps
let ownedStructure



export function update(){
    myCreeps = getObjectsByPrototype(Creep).filter(creep=>creep.my)
    ownedStructure = getObjectsByPrototype(OwnedStructure)

    extensions = ownedStructure.filter(str=>str.my&&str instanceof StructureExtension)

    containeRresources = getObjectsByPrototype(StructureContainer).filter(resource=>0<resource.store.getUsedCapacity())
    neutralContaineResources = containeRresources.filter(r=>r.ticksToDecay!=null)

    for(let y = 0; y < 100; y++) {
        for(let x = 0; x < 100; x++) {
            let tile = getTerrainAt({x: x, y: y});
            let weight =
                tile === TERRAIN_WALL  ? 255 : // wall  => unwalkable
                tile === TERRAIN_SWAMP ?   4 : // swamp => weight:  1
                                           2 ; // plain => weight:  1
            //;
        }
    }
    ownedStructure.forEach(os=>{
        if(os instanceof StructureSpawn)
            matrixEnergyCollector.set(os.x, os.y, 10)
    })
    myCreeps.forEach(creep=>{
        matrixEnergyCollector.set(creep.x, creep.y, 10)
    })


}



const ET_STATE_LOAD = 0;
const ET_STATE_UNLOAD = 0;

export function trySpawnEnergyTransporter(spawn){
    const creep = spawn.trySpawn([CARRY,MOVE,CARRY,MOVE])
    if(!creep) return

    creep.state = ET_STATE_LOAD
    creep.update = function(){
        
    }
    return creep
}

function findRresourcesEC(pos){
    const target = neutralContaineResources.map(resource=>{
        return {object:resource,harvestTime:resource.ticksToDecay-searchPath(pos, resource,pathEnergyCollector).cost}
    }).sort((a,b)=>b.harvestTime-a.harvestTime)[0]

    return target
}

const EC_STATE_MAKE_TANK = 0
const EC_STATE_TRANSFER = 1
const EC_STATE_MAKE_EXT = 2
const EC_STATE_MOVE = 3

const matrixEnergyCollector = new CostMatrix
const pathEnergyCollector = {plainCost:1,swampCost:2,costMatrix:matrixEnergyCollector}

export function trySpawnEnergyCollector(spawn){
    const creep = spawn.trySpawn([WORK,WORK,WORK,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY])
    if(!creep) return

    creep.target = findRresourcesEC(creep)
    creep.state = EC_STATE_MOVE
    creep.update = function(){
        if(this.state == EC_STATE_MOVE&&this.target.harvestTime<20&&getTicks()%50==1)
            this.target = findRresourcesEC(this)

        const target = this.target.object
        
        console.log("decay",target.ticksToDecay,"state",this.state,"=",target.x,target.y)

        if(this.state == EC_STATE_MOVE){
            if(!target.store)
                return
            const path = searchPath(this, target,pathEnergyCollector)
            this.moveTo(target);


            console.log("decay",target.ticksToDecay,"path",path.cost,"=",target.ticksToDecay-path.cost,path.path[0])
            if(this.withdraw(target,RESOURCE_ENERGY)!=ERR_NOT_IN_RANGE){
                this.state = EC_STATE_MAKE_TANK
                this.construction = null
            }
        }
        if(this.state == EC_STATE_MAKE_TANK){
            if(!this.construction){
                const res = createConstructionSite(this,StructureContainer)
                this.construction = res.object
                if(res.error)
                    console.log("error in createConstructionSite ",res.error)
            }else if(!this.construction.progressTotal){
                console.log(this.construction)
                this.state = EC_STATE_TRANSFER
                this.container = this.construction.structure
                this.construction = null
            }
            if(this.construction){
                this.build(this.construction)
                
            }
        }
        if(this.state == EC_STATE_TRANSFER){
            
            if(0<this.store.getFreeCapacity()){
                if(!target.store||target.store.getUsedCapacity()<=0){
                    this.state = EC_STATE_MAKE_EXT
                    return
                }
                this.withdraw(target,RESOURCE_ENERGY)
            }else{
                this.transfer(this.container,RESOURCE_ENERGY)
            }
        }
        if(this.state == EC_STATE_MAKE_EXT){
            console.log(!this.construction,this.container.store.getUsedCapacity())
            if(!this.construction&&this.container.store.getUsedCapacity()<400){
                this.state = EC_STATE_MOVE
                this.target = findRresourcesEC(this)
                return
            }

            if(this.construction&&!this.construction.progressTotal){
                if(this.store.getUsedCapacity()<100)
                    this.withdraw(this.container,RESOURCE_ENERGY)
                this.transfer(this.construction.structure,RESOURCE_ENERGY)
                if(this.construction.structure.store.getFreeCapacity()<=0){
                    this.construction = null
                }
            }
            if(!this.construction&&400<this.container.store.getUsedCapacity()){
                for(let dir = 1; dir <= 8; dir+=2) {
                    const res = createConstructionSite(move(this,dir),StructureExtension)
                    if(res.error)
                        console.log("error in createConstructionSite ",res.error)
                    else{
                        this.construction = res.object
                        break
                    }
                }
                if(!this.construction){
                    this.state = EC_STATE_MOVE
                    this.target = findRresourcesEC(this)
                    this.transfer(this.container,RESOURCE_ENERGY)
                    return 
                }
            }
            if(this.construction){
                if(this.store.getUsedCapacity()<15)
                    this.withdraw(this.container,RESOURCE_ENERGY)
                this.build(this.construction)
            }
        }
    }


    return creep
}