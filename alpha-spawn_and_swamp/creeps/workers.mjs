import { getObjectsByPrototype,getRange,findClosestByRange,createConstructionSite,findPath,getDirection,getTerrainAt,findInRange,getTicks} from '/game/utils';
import { Creep, StructureSpawn ,StructureContainer,ConstructionSite,StructureTower,StructureRampart,OwnedStructure,StructureExtension} from '/game/prototypes';
import {MOVE,ERR_NOT_ENOUGH_ENERGY ,RESOURCE_ENERGY,ERR_NOT_IN_RANGE,CARRY,ATTACK,RANGED_ATTACK,HEAL,WORK,TERRAIN_WALL,TERRAIN_SWAMP} from '/game/constants';
import {TOP,TOP_RIGHT,RIGHT,BOTTOM_RIGHT,BOTTOM,BOTTOM_LEFT,LEFT,TOP_LEFT} from '/game/constants';
import { } from '/arena';
import {CostMatrix,searchPath} from '/game/path-finder';
import {Visual} from '/game/visual';


import {canMove,check3x3,move,getDirection4,clamp1,getMin,entrySpawn} from '../utils';
import * as ep from '../info/enemies';
import * as cp from '../info/creeps';
import * as util from '../utils';

import * as pf from '../info/profiler';

let DEBUG = false

let constructionSites

let allContaineRresources
let containeRresources
let neutralContaineResources
let staticContaineResources
let startContaineResources

let energyCache
let emptyEnergyCache

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

    extensions = cp.ownedStructures.filter(str=>str.my&&str instanceof StructureExtension)

    //すべてのリソースコンテナ
    allContaineRresources = getObjectsByPrototype(StructureContainer).filter(rc=>rc.x!=null)

    //中身入りのリソースコンテナ
    containeRresources = allContaineRresources.filter(resource=>0<resource.store.getUsedCapacity())

    //スタート地点の中身入りリソースコンテナ
    startContaineResources = containeRresources.filter(r=>getRange(mySpawn,r)<6)
    //自然沸きした中身入りリソースコンテナ
    neutralContaineResources = containeRresources.filter(r=>r.ticksToDecay!=null)


    //敵のものを含む
    staticContaineResources = containeRresources.filter(r=>r.ticksToDecay==null)

    constructionSites = getObjectsByPrototype(ConstructionSite)
    
    let visual = new Visual(0,false)
    
    //リソースキャッシュを作成
    energyCache = staticContaineResources.filter(rc=>rc.isCache)
    emptyEnergyCache = energyCache.filter(rc=>0<rc.store.getUsedCapacity(RESOURCE_ENERGY)&&rc.findInRange(extensions, EXTENSION_RANGE).some(ex=>ex.store.energy<20))
    //console.log("isCache",energyCache.length)

    for(let y = 0; y < 100; y++) {
        for(let x = 0; x < 100; x++) {
            matrixWorker.set(x,y,0)
        }
    } 
    cp.ownedStructures.forEach(os=>{
        if(!(os instanceof StructureContainer||os instanceof StructureRampart)){
            matrixWorker.set(os.x, os.y, 20)
        }
    })
    cp.creeps.forEach(creep=>{
        matrixWorker.set(creep.x, creep.y, 20)
    })
    constructionSites.forEach(cs=>{
        matrixWorker.set(cs.x, cs.y, 20)
    })
    
    
    energyTransporters = energyTransporters.filter(creep=>creep.hitsMax)
    energyTransporters.forEach(et=>et.update())
    if(energyTransporters.length<2){
        const priority = 10
        trySpawnEnergyTransporter(priority,(creep)=>energyTransporters.push(creep))
    }
    // pf.lap('ET','#80FF00')
    energyCollectors = energyCollectors.filter(creep=>creep.hitsMax)
    energyCollectors.forEach(et=>et.update())
    if(energyCollectors.length<2){
        const priority = 6
        trySpawnEnergyCollector(priority,(creep)=>energyCollectors.push(creep))
    }
    
}

const EXTENSION_RANGE = 8

const matrixWorker = new CostMatrix

//=== エネルギー搬送 ===

function findRresourcesET(pos){
    let resources
    //スポーン地点のコンテナが残っているか
    if(0<startContaineResources.length){
        resources = startContaineResources
    }else{
        resources = emptyEnergyCache
    }
    
    /*
    //別のワーカーがターゲットしていて自分のほうが遠いものを除外
    const otherET = energyTransporters.filter(ec=>ec.id!=creep.id)
    if(0<otherEC.length)
        resources = resources.filter(rc=>!otherET.some(other=>other.target!=null&&other.target.object.id==rc.id&&rinfo.harvestTime<=other.target.harvestTime))

    //仮
    let max = getMin(resources,(a,b)=>b.harvestTime-a.harvestTime)
    //競合していて距離が自分より遠いワーカーに再計算フラグを
    otherEC.filter(other=>other.target!=null&&other.target.object.id==max.object.id&&other.target.harvestTime<max.harvestTime)
        .forEach(other=>other.conflict = true)
    //*/

    const res = util.getMin1(resources,(rc)=>getRange(pos,rc))
    return res
}

function findDumpET(pos){
    return findClosestByRange(pos, allContaineRresources.filter(re=>0<re.store.getFreeCapacity()))
}

function findStoreET(pos){
    const stores = extensions
        .filter(ext=>0<ext.store.getFreeCapacity(RESOURCE_ENERGY))
        .concat([mySpawn])
        .filter(ext=>getRange(pos,ext)<=EXTENSION_RANGE)
        .map(resource=>{
            return {object:resource,cost:searchPath(pos, resource,pathEnergyTransporter).cost}
        })
        const res = getMin(stores,(a,b)=>a.cost-b.cost)
    return res==null?null:res.object
}

let moveEX = function(pos,costMatrix=null){
    this.toPos = pos

}

let updateMove = function(){

}

const ET_STATE_LOAD = 0;
const ET_STATE_UNLOAD = 1;
const ET_STATE_MOVE = 2;

const ET_CARRY_SIZE = 100

const pathEnergyTransporter = {plainCost:1,swampCost:1,costMatrix:matrixWorker}

export function trySpawnEnergyTransporter(priority,callback){
    entrySpawn([CARRY,CARRY,MOVE,MOVE],priority,(creep)=>{
        creep.state = ET_STATE_LOAD
        creep.moveEX = moveEX
        
        creep.update = function(){
            if(this.hits==null)
                return

            let from = findRresourcesET(this)
            let to = findStoreET(this)                

            if(from==null){
                //渡す先がない
                if(DEBUG)console.log("ET target lost from")
                return
            }else{
                if(DEBUG)console.log(`ET from[${from.x}, ${from.y}]`)
            }
            if(to!=null)
                if(DEBUG)console.log(`to[${to.x}, ${to.y}]`)
            
            if(this.state == ET_STATE_LOAD){
                //full or 引き出しに成功
                if(this.store.getFreeCapacity(RESOURCE_ENERGY)<=0||util.tryJob(this.withdraw(from,RESOURCE_ENERGY),'withdraw',DEBUG)){
                    this.state=ET_STATE_UNLOAD
                    this.moveTo(to,pathEnergyTransporter)
                }else{
                    this.moveTo(from,pathEnergyTransporter)
                }
            }else if(this.state == ET_STATE_UNLOAD){
                if(to==null){
                    if(DEBUG)console.log("ET target lost to")
                    to = findDumpET(this)
                }

                //empty or 移送に成功
                const amount = Math.min(to.store.getFreeCapacity(RESOURCE_ENERGY),this.store.getUsedCapacity(RESOURCE_ENERGY))
                if(this.store.getUsedCapacity(RESOURCE_ENERGY)<=0||util.tryJob(this.transfer(to,RESOURCE_ENERGY,amount),'transfer',DEBUG)){
                    //空になるなら
                    if(this.store.getUsedCapacity(RESOURCE_ENERGY)<=to.store.getFreeCapacity(RESOURCE_ENERGY)){
                        this.state=ET_STATE_LOAD
                        this.moveTo(from,pathEnergyTransporter)    
                    }else{
                        if(DEBUG)console.log("????????????")
                    }
                }else{
                    this.moveTo(to,pathEnergyTransporter)
                }
            }
            //util.tryJob(this.withdraw(from,RESOURCE_ENERGY),'withdraw')
            //util.tryJob(this.transfer(to,RESOURCE_ENERGY),'transfer')
        }

        callback(creep)
    })
}


//=== エネルギー確保 ===

function findRresourcesEC(creep){
    let resources = neutralContaineResources.map(resource=>{
        return {object:resource,harvestTime:resource.ticksToDecay-searchPath(creep, resource,pathEnergyCollector).cost}
    })
    //別のワーカーがターゲットしていて自分のほうが遠いものを除外
    const otherEC = energyCollectors.filter(ec=>ec.id!=creep.id)
    if(0<otherEC.length)
        resources = resources.filter(rinfo=>!otherEC.some(other=>other.target!=null&&other.target.object.id==rinfo.object.id&&rinfo.harvestTime<=other.target.harvestTime))

    //仮
    let max = getMin(resources,(a,b)=>b.harvestTime-a.harvestTime)
    //競合していて距離が自分より遠いワーカーに再計算フラグを
    otherEC.filter(other=>other.target!=null&&other.target.object.id==max.object.id&&other.target.harvestTime<max.harvestTime)
        .forEach(other=>other.conflict = true)
    return max
}

const EC_STATE_WORK = 1
const EC_STATE_DISCHARGE = 2
const EC_STATE_MOVE = 0

const pathEnergyCollector = {plainCost:1,swampCost:2,costMatrix:matrixWorker}

export function trySpawnEnergyCollector(priority,callback){
    entrySpawn([WORK,WORK,WORK,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY],priority,(creep)=>{

        creep.target = findRresourcesEC(creep)
        creep.state = EC_STATE_MOVE
        creep.constructions = []
        creep.extensions = []
        creep.conflict = false

        creep.onDeath = function(){
            this.constructions.forEach(cs=>cs.remove())
        }

        creep.update = function(){
           
            
            //console.log("decay",target.ticksToDecay,"state",this.state,"=",target.x,target.y)

            //console.log("state",this.state)
            
            if(this.state == EC_STATE_MOVE){
                this.doMove()
            }else if(this.state == EC_STATE_WORK){
                this.doWork()
            }else if(this.state == EC_STATE_DISCHARGE){
                util.tryJob(this.transfer(this.container,RESOURCE_ENERGY),'transfer',DEBUG)
                this.state = EC_STATE_MOVE
                this.target = findRresourcesEC(this)
                this.doMove()
            }
        }


        //今のtickでtransferができるならinstant
        creep.transitDischarge = function(instant){
            //空か移動に成功したなら
            if(this.store.getUsedCapacity()<=0||(instant&&util.tryJob(this.transfer(this.container,RESOURCE_ENERGY),'transfer',DEBUG))){
                this.state = EC_STATE_MOVE
                this.target = findRresourcesEC(this)
                this.doMove()
            }else{
                this.state = EC_STATE_DISCHARGE
            }
        }

        creep.doMove = function(){
            if(this.conflict||this.target==null||this.target.harvestTime<20&&getTicks()%50==1||this.target.object.store==null){
                this.conflict = false
                this.target = findRresourcesEC(this)
            }

            if(this.target==null||!this.target.object.store){
                if(DEBUG)console.log("err container not found")
                return
            }

            const target = this.target.object
            
            if(!this.withdraw(target,RESOURCE_ENERGY)){
                //到着
                this.state = EC_STATE_WORK
                this.container = null
                this.extensions = []
                this.constructions.forEach(cs=>cs.remove())
                this.constructions = []
                
                const nearCache = this.findInRange(extensions,EXTENSION_RANGE).filter((rc)=>{
                    const res = searchPath(this,rc,{plainCost:1,swampCost:5,maxCost:EXTENSION_RANGE})
                    if(DEBUG)console.log("search chche",rc.x,rc.y," ",res.cost,res.incomplete)
                    return !res.incomplete
                }).length
                if(DEBUG)console.log("near cache",nearCache)

                //コンテナ
                util.tryCreateConstructionSite(this,StructureContainer,obj=>this.constructions.push(obj))
                //防壁
                util.tryCreateConstructionSite(this,StructureRampart,obj=>this.constructions.push(obj))
                //近くにないなら
                if(nearCache<4){
                    let makeCount = Math.min(4,4-nearCache)
                    //エクステンション
                    for(let dir = 1; dir <= 8 && 0 < makeCount; dir+=2) {
                        util.tryCreateConstructionSite(move(this,dir),StructureExtension,obj=>this.constructions.push(obj))
                        makeCount --
                    }
                }
                    

                this.doWork()
            }else{
                const path = searchPath(this, target,pathEnergyCollector)
                if(DEBUG)console.log("decay",target.ticksToDecay,"path",path.cost,"=",target.ticksToDecay-path.cost,path.path[0])
                this.moveTo(target,pathEnergyCollector);
            }
        }

        creep.doWork = function(){
            const target = this.target.object

            //建設完了確認
            if(0 < this.constructions.length){
                //建設が終わったなら
                if(util.isDone(this.constructions[0])){
                const finish = this.constructions.shift().structure
                    const name = finish.constructor.name
                    //コンテナできたら格納
                    if(name=='StructureContainer'){
                        finish.isCache = true
                        this.container = finish
                    }else if(name=='StructureExtension'){
                        this.extensions.push(finish)
                    }
                }
            }

            let from,to

            if(target.store==null||target.store.getUsedCapacity()<=0){
                from = this.container
                to = this.extensions.find(ex=>{
                    return ex.hits!=null&&0<ex.store.getFreeCapacity(RESOURCE_ENERGY)
                })
            }else{
                //自然沸きがのこっているなら
                from = target
                to = this.container
            }

            let op = false
            let doBuildOrTransfer = false
            let doWithdraw = false
            //エネルギーを移す先があるなら
            if(to!=null){
                if(30<this.store.getFreeCapacity(RESOURCE_ENERGY)&&this.store.getUsedCapacity(RESOURCE_ENERGY)<to.store.getFreeCapacity(RESOURCE_ENERGY)){
                    if(util.tryJob(this.withdraw(from,RESOURCE_ENERGY),'withdraw',DEBUG))
                        doWithdraw = true
                }else{
                    const amount = Math.min(this.store.getUsedCapacity()-30,to.store.getFreeCapacity(RESOURCE_ENERGY))
                    if(util.tryJob(this.transfer(to,RESOURCE_ENERGY,amount),'transfer',DEBUG))
                        doBuildOrTransfer = true
                }
            }

            //建設するものがあるなら
            if(0 < this.constructions.length){
                //まだあるなら
                if(this.store.getUsedCapacity()<115)
                    if(util.tryJob(this.withdraw(from,RESOURCE_ENERGY),'withdraw',DEBUG))
                        doWithdraw = true
                if(!doBuildOrTransfer){
                    if(util.tryJob(this.build(this.constructions[0]),'build',DEBUG))
                        doBuildOrTransfer = true
                }

                //エネルギー
                if(this.store.getUsedCapacity() < 15&&(from==null||from.store==null||from.store.getUsedCapacity() < 15)){

                    this.state = EC_STATE_MOVE
                    this.target = findRresourcesEC(this)
                    if(DEBUG)console.log("break")
                }


            }else{
                //これで終わりなら
                this.transitDischarge(!doBuildOrTransfer&&!doWithdraw)
            }   
        }
        callback(creep)
    })
}