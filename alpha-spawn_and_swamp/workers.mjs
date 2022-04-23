import { getObjectsByPrototype,getRange,findClosestByRange,createConstructionSite,findPath,getDirection,getTerrainAt,findInRange,getTicks} from '/game/utils';
import { Creep, StructureSpawn ,StructureContainer,ConstructionSite,StructureTower,StructureRampart,OwnedStructure,StructureExtension} from '/game/prototypes';
import {MOVE,ERR_NOT_ENOUGH_ENERGY ,RESOURCE_ENERGY,ERR_NOT_IN_RANGE,CARRY,ATTACK,RANGED_ATTACK,HEAL,WORK,TERRAIN_WALL,TERRAIN_SWAMP} from '/game/constants';
import {TOP,TOP_RIGHT,RIGHT,BOTTOM_RIGHT,BOTTOM,BOTTOM_LEFT,LEFT,TOP_LEFT} from '/game/constants';
import { } from '/arena';
import {CostMatrix,searchPath} from '/game/path-finder';

import {canMove,check3x3,move,getDirection4,clamp1,getMin,entrySpawn} from './utils';
import * as ep from './enemies';
import * as cp from './creeps';

import {Visual} from '/game/visual';

let constructionSites

let allContaineRresources
let containeRresources
let neutralContaineResources
let staticContaineResources
let startContaineResources

let emptyExtensions

let extensions

let isInit,mySpawn

let energyCollectors = []
let energyTransporters = []

function init(){
    mySpawn = getObjectsByPrototype(StructureSpawn).find(spawn=>spawn.my)
}

export function update(){
    if(!isInit){
        init();
        isInit=true;
    }

    extensions = cp.ownedStructures.filter(str=>str.my&&str instanceof StructureExtension&&str.store.energy<100)

    allContaineRresources = getObjectsByPrototype(StructureContainer).filter(rc=>rc.x!=null)


    containeRresources = allContaineRresources.filter(resource=>0<resource.store.getUsedCapacity())

    startContaineResources = containeRresources.filter(r=>getRange(mySpawn,r)<6)

    staticContaineResources = containeRresources.filter(r=>r.ticksToDecay==null)
    neutralContaineResources = containeRresources.filter(r=>r.ticksToDecay!=null)

    constructionSites = getObjectsByPrototype(ConstructionSite)
    
    let visual = new Visual(0,false)
    
    startContaineResources.forEach(rc=>{
        visual.circle(rc)
    })

    //リソースキャッシュを作成
    emptyExtensions = staticContaineResources.filter(rc=>rc.findInRange(extensions, 3).some(ex=>ex.store.energy<20))


    for(let y = 0; y < 100; y++) {
        for(let x = 0; x < 100; x++) {
            matrixWorker.set(x,y,0)
        }
    } 
    cp.ownedStructures.forEach(os=>{
        if(!(os instanceof StructureContainer)){
            matrixWorker.set(os.x, os.y, 20)
        }
    })
    cp.myCreeps.forEach(creep=>{
        matrixWorker.set(creep.x, creep.y, 20)
    })
    constructionSites.forEach(cs=>{
        matrixWorker.set(cs.x, cs.y, 20)
    })
    
    energyTransporters = energyTransporters.filter(creep=>creep.hitsMax)
    energyTransporters.forEach(et=>et.update())
    if(energyTransporters.length<2){
        const priority = energyTransporters.length<=2 ? 10 : 3
        trySpawnEnergyTransporter(priority,(creep)=>energyTransporters.push(creep))
    }

    energyCollectors = energyCollectors.filter(creep=>creep.hitsMax)
    energyCollectors.forEach(et=>et.update())
    if(energyCollectors.length<0){
        const priority = 5
        trySpawnEnergyCollector(priority,(creep)=>energyCollectors.push(creep))
    }
}


const matrixWorker = new CostMatrix

//=== エネルギー搬送 ===

function findRresourcesET(pos){
    if(0<startContaineResources.length){
        const resources = startContaineResources.map(resource=>{
            return {object:resource,harvestTime:resource.ticksToDecay-searchPath(pos, resource,pathEnergyTransporter).cost}
        })
        const res = getMin(resources,(a,b)=>a.cost-b.cost)
        return res==null ? null : res.object
    }else{
        const resources = emptyExtensions.map(resource=>{
            return {object:resource,cost:searchPath(pos, resource,pathEnergyTransporter).cost}
        })
        const res = getMin(resources,(a,b)=>a.cost-b.cost)
        return res==null ? null : res.object
    }
}

function findDumpET(pos){
    return findClosestByRange(pos, allContaineRresources.filter(re=>0<re.store.getFreeCapacity()))
}

function findStoreET(pos){
    const stores = extensions.concat([mySpawn]).map(resource=>{
            return {object:resource,cost:searchPath(pos, resource,pathEnergyTransporter).cost}
        })
    return getMin(stores,(a,b)=>a.cost-b.cost).object
}

let moveEX = function(pos,costMatrix=null){
    this.toPos = pos

}

let updateMove = function(){

}

const ET_STATE_LOAD = 0;
const ET_STATE_UNLOAD = 1;
const ET_STATE_MOVE = 2;

const pathEnergyTransporter = {plainCost:1,swampCost:1,costMatrix:matrixWorker}

export function trySpawnEnergyTransporter(priority,callback){
    entrySpawn([CARRY,CARRY,MOVE,MOVE],priority,(creep)=>{
        creep.state = ET_STATE_LOAD
        creep.moveEX = moveEX
        
        creep.update = function(){
            if(this.hits==null)
                return

            if(this.state==ET_STATE_LOAD&&0<this.store.getUsedCapacity(RESOURCE_ENERGY)){
                this.state=ET_STATE_UNLOAD;
                this.et_to = findStoreET(this)
            }

            if(this.state == ET_STATE_UNLOAD){
                if(this.store.getUsedCapacity()<=0){
                    this.state=ET_STATE_LOAD
                    this.et_from = findRresourcesET(this)
                }else if(4<getRange(this,this.et_to)&&startContaineResources.length<=0){
                    this.state=ET_STATE_MOVE
                    this.et_to = findDumpET(this)
                }
            }

            if(this.state==ET_STATE_MOVE&&this.store.getUsedCapacity()<=0){
                this.state=ET_STATE_LOAD
                this.et_from = findRresourcesET(this)
            }

            console.log("state ",this.state)
            if(this.et_from)
                console.log("from ",this.et_from.x,this.et_from.y)
            if(this.et_to)
                console.log("to ",this.et_to.x,this.et_to.y)

            if(this.state==ET_STATE_MOVE){
                if(this.et_to==null||this.et_to.store==null||this.et_to.store.getFreeCapacity()<=0)
                    this.et_to = findDumpET(this)
                if(this.transfer(this.et_to,RESOURCE_ENERGY)==ERR_NOT_IN_RANGE){
                    const sp = searchPath(this, {pos:this.et_to,range:1}, pathEnergyTransporter)
                    console.log(sp.path[0],matrixWorker.get(sp.path[0].x,sp.path[0].y))
                    this.moveTo(sp.path[0],pathEnergyTransporter)
                    //this.moveTo(this.et_to,pathEnergyTransporter)
                }
            }

            if(this.state==ET_STATE_LOAD){
                if(this.et_from==null||this.et_from.store==null||this.et_from.store.energy<=0)
                    this.et_from = findRresourcesET(this)

                if(this.withdraw(this.et_from,RESOURCE_ENERGY)==ERR_NOT_IN_RANGE){
                    const sp = searchPath(this, {pos:this.et_from,range:1}, pathEnergyTransporter)
                    console.log(sp.path[0],sp.path.length,matrixWorker.get(sp.path[0].x,sp.path[0].y))
                    this.moveTo(sp.path[0],pathEnergyTransporter)
                }
            }

            if(this.state == ET_STATE_UNLOAD){
                if(this.et_to==null||this.et_to.store==null||0<this.et_to.store.energy)
                    this.et_to = findStoreET(this)
                if(this.transfer(this.et_to,RESOURCE_ENERGY)==ERR_NOT_IN_RANGE){
                    const sp = searchPath(this, {pos:this.et_to,range:1}, pathEnergyTransporter)
                    console.log(sp.path[0],sp.path.length,matrixWorker.get(sp.path[0].x,sp.path[0].y))
                    this.moveTo(sp.path[0],pathEnergyTransporter)
                    //this.moveTo(this.et_to,pathEnergyTransporter)
                }
            }
        }

        callback(creep)
    })
}

//=== エネルギー確保 ===

function findRresourcesEC(pos){
    
    const resources = neutralContaineResources.map(resource=>{
        return {object:resource,harvestTime:resource.ticksToDecay-searchPath(pos, resource,pathEnergyCollector).cost}
    })
    return getMin(resources,(a,b)=>b.harvestTime-a.harvestTime)
}

const EC_STATE_MAKE_TANK = 0
const EC_STATE_TRANSFER = 1
const EC_STATE_MAKE_EXT = 2
const EC_STATE_MOVE = 3

const pathEnergyCollector = {plainCost:1,swampCost:2,costMatrix:matrixWorker}

export function trySpawnEnergyCollector(priority,callback){
    entrySpawn([WORK,WORK,WORK,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY],priority,(creep)=>{

        creep.target = findRresourcesEC(creep)
        creep.state = EC_STATE_MOVE
        creep.update = function(){

            if(this.state == EC_STATE_MOVE&&(this.target==null||this.target.harvestTime<20&&getTicks()%50==1||this.target.object.store==null))
                this.target = findRresourcesEC(this)

            const target = this.target.object
            
            //console.log("decay",target.ticksToDecay,"state",this.state,"=",target.x,target.y)

            if(this.state == EC_STATE_MOVE){
                if(!target.store)
                    return
                const path = searchPath(this, target,pathEnergyCollector)
                this.moveTo(target,pathEnergyCollector);


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
                if(!this.construction){
                    if(this.container.store.getUsedCapacity()<400){
                        //建設していない+残りエネルギーが少ないならステート終了
                        this.state = EC_STATE_MOVE
                        this.target = findRresourcesEC(this)
                        this.transfer(this.container,RESOURCE_ENERGY)
                        return
                    }else{
                        //建設を試みる
                        for(let dir = 1; dir <= 8; dir+=2) {
                            const res = createConstructionSite(move(this,dir),StructureExtension)
                            if(!res.error){
                                this.construction = res.object
                                break
                            }
                        }
                        //失敗したらステート終了
                        if(!this.construction){
                            this.state = EC_STATE_MOVE
                            this.target = findRresourcesEC(this)
                            this.transfer(this.container,RESOURCE_ENERGY)
                            return 
                        }
                    }
                }else{
                    if(this.construction.progressTotal){
                        //建設中なら
                        if(this.store.getUsedCapacity()<15)
                            this.withdraw(this.container,RESOURCE_ENERGY)
                        this.build(this.construction)
                    }else{
                        //建設後にエネルギーを詰める
                        if(this.store.getUsedCapacity()<100)
                            this.withdraw(this.container,RESOURCE_ENERGY)

                        this.transfer(this.construction.structure,RESOURCE_ENERGY)
                        if(this.construction.structure.store.getFreeCapacity()<=0)
                            this.construction = null                
                    }   
                }
            }
        }
        callback(creep)
    })
}