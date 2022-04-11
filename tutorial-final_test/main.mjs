import { getObjectsByPrototype,getRange,findClosestByRange,createConstructionSite} from '/game/utils';
import { Creep, StructureSpawn ,StructureContainer,ConstructionSite,StructureTower,Source} from '/game/prototypes';
import {MOVE,ERR_NOT_ENOUGH_ENERGY ,RESOURCE_ENERGY,ERR_NOT_IN_RANGE,CARRY,ATTACK,RANGED_ATTACK,HEAL,WORK} from '/game/constants';
import { } from '/arena';

class spawn_holder{
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

class creep_holder{
    constructor(creep) {
        this.creep = creep;
    }

    isDead(){
        return this.creep.hits==null;
    }
}

var isInit,mySpawn,mySpawnHolder,source

var myConstruct=[]

export function init(){
    
    mySpawn = getObjectsByPrototype(StructureSpawn).find(spawn=>spawn.my)

    mySpawnHolder = new spawn_holder(mySpawn)

    source = getObjectsByPrototype(Source)[0];

    myConstruct.push(createConstructionSite({x: mySpawn.x, y: mySpawn.y-2},StructureTower).object)
}

var harvester,healer,attacker

export function loop() {
    if(!isInit){
        init();
        isInit=true;
    }



    if(!harvester)
        harvester = mySpawnHolder.trySpawn([WORK,WORK,WORK,WORK,CARRY,MOVE])
    else{
        if(harvester.store.getFreeCapacity(RESOURCE_ENERGY)) {
            if(harvester.harvest(source) == ERR_NOT_IN_RANGE) {
                harvester.moveTo(source);
            }
        } else {
            if(harvester.transfer(mySpawn, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                harvester.moveTo(mySpawn);
            }
        }
    }
    if(!healer)
        healer = mySpawnHolder.trySpawn([HEAL,HEAL,HEAL,MOVE])
    else{
        healer.moveTo({x:52,y:49})
        healer.heal(mySpawn)
    }

    var enemyCreeps = getObjectsByPrototype(Creep).filter(creep => !creep.my)
    if(!attacker)
        attacker = mySpawnHolder.trySpawn([ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,MOVE])
    else{
        let near = attacker.findClosestByRange(enemyCreeps)
        if(attacker.attack(near)==ERR_NOT_IN_RANGE)
            attacker.moveTo(near);
    }

    var creep = getObjectsByPrototype(Creep).find(i => i.my);
    
    var spawn = getObjectsByPrototype(StructureSpawn).find(i => i.my);

    
}