import { getObjectsByPrototype,getRange,findClosestByRange,createConstructionSite,findPath,getDirection,getTerrainAt,findInRange,getTicks} from '/game/utils';
import { Creep, StructureSpawn ,StructureContainer,ConstructionSite,StructureTower,StructureRampart,OwnedStructure,StructureExtension} from '/game/prototypes';
import {MOVE,ERR_NOT_ENOUGH_ENERGY ,RESOURCE_ENERGY,ERR_NOT_IN_RANGE,CARRY,ATTACK,RANGED_ATTACK,HEAL,WORK,TERRAIN_WALL,TERRAIN_SWAMP} from '/game/constants';
import {TOP,TOP_RIGHT,RIGHT,BOTTOM_RIGHT,BOTTOM,BOTTOM_LEFT,LEFT,TOP_LEFT} from '/game/constants';
import { } from '/arena';
import {CostMatrix,searchPath} from '/game/path-finder';

import {canMove,check3x3,move,getDirection4,clamp1,getMin} from './utils';
import * as ep from './enemies';

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
let staticContaineResources
let startContaineResources

let emptyExtensions

let extensions

let myCreeps
let ownedStructures

var isInit,spawn

export function init(){
    spawn = getObjectsByPrototype(StructureSpawn).find(spawn=>spawn.my)
}

export function update(){
    if(!isInit){
        init();
        isInit=true;
    }

    myCreeps = getObjectsByPrototype(Creep).filter(creep=>creep.my)
    ownedStructures = getObjectsByPrototype(OwnedStructure)

    extensions = ownedStructures.filter(str=>str.my&&str instanceof StructureExtension&&str.store.energy<100)

    allContaineRresources = getObjectsByPrototype(StructureContainer)

    containeRresources = allContaineRresources.filter(resource=>0<resource.store.getUsedCapacity())

    startContaineResources = containeRresources.filter(r=>getRange(spawn,r)<6)

    staticContaineResources = containeRresources.filter(r=>r.ticksToDecay==null)
    neutralContaineResources = containeRresources.filter(r=>r.ticksToDecay!=null)

    //リソースキャッシュを作成
    emptyExtensions = staticContaineResources.filter(rc=>rc.findInRange(extensions, 3).some(ex=>ex.store.energy<20))

    //extensions.forEach(ex=>console.log(ex.store,ex.store.energy<20))
    

    //console.log(startContaineResources)

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
    ownedStructures.forEach(os=>{
        matrixWorker.set(os.x, os.y, 10)
    })
    myCreeps.forEach(creep=>{
        matrixWorker.set(creep.x, creep.y, 10)
    })


}

const matrixWorker = new CostMatrix

//=== エネルギー搬送 ===

function findRresourcesET(pos){
    if(0<startContaineResources.length){
        const resources = startContaineResources.map(resource=>{
            return {object:resource,harvestTime:resource.ticksToDecay-searchPath(pos, resource,pathEnergyTransporter).cost}
        })
        return getMin(resources,(a,b)=>a.cost-b.cost).object
    }else{
        const resources = emptyExtensions.map(resource=>{
            return {object:resource,cost:searchPath(pos, resource,pathEnergyTransporter).cost}
        })
        return getMin(resources,(a,b)=>a.cost-b.cost).object
    }
}

function findDumpET(pos){
    return findClosestByRange(pos, allContaineRresources.filter(re=>0<re.store.getFreeCapacity()))
}

function findStoreET(pos){
    const stores = extensions.concat([spawn]).map(resource=>{
            return {object:resource,cost:searchPath(pos, resource,pathEnergyTransporter).cost}
        })
    return getMin(stores,(a,b)=>a.cost-b.cost).object
}

const ET_STATE_LOAD = 0;
const ET_STATE_UNLOAD = 1;
const ET_STATE_MOVE = 2;

const pathEnergyTransporter = {plainCost:1,swampCost:1,costMatrix:matrixWorker}

export function trySpawnEnergyTransporter(spawn){
    const creep = spawn.trySpawn([CARRY,CARRY,MOVE,MOVE])
    if(!creep) return

    creep.state = ET_STATE_LOAD
    
    creep.update = function(){
        if(this.hits==null)
            return

        if(this.state==ET_STATE_LOAD&&this.store.getFreeCapacity(RESOURCE_ENERGY)<=0){
            this.state=ET_STATE_UNLOAD;
            this.et_to = findStoreET(this)
        }

        if(this.state == ET_STATE_UNLOAD){
            if(this.store.getUsedCapacity()<=0){
                this.state=ET_STATE_LOAD
                this.et_from = findRresourcesET(this)
            }else if(3<getRange(this,this.et_to)){
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
            if(this.et_to==null||this.et_to.store==null||this.et_to.getFreeCapacity()<=0)
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
                console.log(sp.path[0],matrixWorker.get(sp.path[0].x,sp.path[0].y))
                this.moveTo(sp.path[0],pathEnergyTransporter)
            }
        }

        if(this.state == ET_STATE_UNLOAD){
            if(this.et_to==null||this.et_to.store==null||0<this.et_to.store.energy)
                this.et_to = findStoreET(this)
            if(this.transfer(this.et_to,RESOURCE_ENERGY)==ERR_NOT_IN_RANGE){
                const sp = searchPath(this, {pos:this.et_to,range:1}, pathEnergyTransporter)
                console.log(sp.path[0],matrixWorker.get(sp.path[0].x,sp.path[0].y))
                this.moveTo(sp.path[0],pathEnergyTransporter)
                //this.moveTo(this.et_to,pathEnergyTransporter)
            }
        }
    }
    return creep
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

export function trySpawnEnergyCollector(spawn){
    const creep = spawn.trySpawn([WORK,WORK,WORK,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY])
    if(!creep) return

    creep.target = findRresourcesEC(creep)
    creep.state = EC_STATE_MOVE
    creep.update = function(){

        
        if(this.state == EC_STATE_MOVE&&this.target.harvestTime<20&&getTicks()%50==1)
            this.target = findRresourcesEC(this)

        const target = this.target.object
        
        //console.log("decay",target.ticksToDecay,"state",this.state,"=",target.x,target.y)

        if(this.state == EC_STATE_MOVE){
            if(!target.store)
                return
            const path = searchPath(this, target,pathEnergyCollector)
            this.moveTo(target,pathEnergyCollector);


            //console.log("decay",target.ticksToDecay,"path",path.cost,"=",target.ticksToDecay-path.cost,path.path[0])
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


    return creep
}