import { getObjectsByPrototype,getRange,findClosestByRange,createConstructionSite} from '/game/utils';
import { Creep, StructureSpawn ,StructureContainer,ConstructionSite,StructureTower,StructureRampart} from '/game/prototypes';
import {MOVE,ERR_NOT_ENOUGH_ENERGY ,RESOURCE_ENERGY,ERR_NOT_IN_RANGE,CARRY,ATTACK,RANGED_ATTACK,HEAL,WORK} from '/game/constants';
import { } from '/arena';

class creep_holder{
    constructor(creep) {
        this.creep = creep;
    }

    isDead(){
        return this.creep.hits==null;
    }
}

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

class creep_manager{
    constructor(squad){
        this.holders=[];
        this.squad = squad
    }

    update(){
        this.holders = this.holders.filter(holder=>!holder.isDead())
        this.holders.forEach(holder=>{
            holder.squad = this.squad;
            holder.update()
        })
    }

    count(){
        return this.holders.length
    }
}

const WORKER_STATE_BUILD = 0;
const WORKER_STATE_TRANSFER = 1;
const WORKER_STATE_SUPPLY = 2;

class energy_collector extends creep_holder{

    constructor(creep){
        super(creep)
        this.state = WORKER_STATE_SUPPLY
    }

    findTarget(){
        let resources=getObjectsByPrototype(StructureContainer).filter(resource=>0<resource.store.getUsedCapacity())
        this.target = this.creep.findClosestByPath(resources)
    }

    update(){
        if(this.creep.id==null){
            return;
        }
        
        if(this.state==WORKER_STATE_SUPPLY){
            if(this.target==null||this.target.store==null||this.target.store.energy<=0)
                this.findTarget();

            if(this.creep.withdraw(this.target,RESOURCE_ENERGY)==ERR_NOT_IN_RANGE){
                this.creep.moveTo(this.target);
            }else if(this.creep.store.getFreeCapacity(RESOURCE_ENERGY)<=0){
                this.state=WORKER_STATE_TRANSFER;
            }
        }else if(this.state == WORKER_STATE_TRANSFER){
            if(this.creep.transfer(mySpawn,RESOURCE_ENERGY)==ERR_NOT_IN_RANGE){
                this.creep.moveTo(mySpawn);
            }else if(this.creep.store.energy<=0){
                this.state=WORKER_STATE_SUPPLY;
            }
        }else if(this.state == WORKER_STATE_BUILD){
            console.log(myConstruct)
            if(myConstruct.length<=0)
                this.state=WORKER_STATE_TRANSFER
            else if(this.creep.build(myConstruct[0])==ERR_NOT_IN_RANGE){
                this.creep.moveTo(myConstruct[0]);
            }else{
                if(this.creep.store.energy<=0){
                    this.state=WORKER_STATE_SUPPLY;
                }
            }
        }
    }
}



class healer extends creep_holder{

    update(){
        if(this.target==null){
            this.creep.moveTo(groupPoint)
            return;
        }

        //回避行動
        let near = this.creep.findClosestByRange(enemyAttacker);
        if(near!=null&&getRange(this.creep,near)<5){
            this.creep.moveTo(groupPoint)
            console.log("healer escape")
        }


        let damagedCreeps = this.squad.members.filter(i => i.creep.hits < i.creep.hitsMax).sort((a,b) => calcHeal(b.creep) - calcHeal(a.creep));
        if(damagedCreeps.length > 0) {
            if(this.creep.heal(damagedCreeps[0].creep) == ERR_NOT_IN_RANGE) {
                //レンジを適当に投げる
                this.creep.rangedHeal(damagedCreeps[0].creep)
                this.creep.moveTo(damagedCreeps[0].creep);
            }
        }else{
            if(0<this.squad.attackers.length)
                this.creep.moveTo(this.squad.attackers[0].creep)
        }
    }
}

class attacker extends creep_holder{

    update(){
        if(this.target==null){
            this.creep.moveTo(groupPoint)
            return
        }

        //回避行動
        let near = this.creep.findClosestByRange(enemyAttacker);
        if(near!=null&&getRange(this.creep,near)<4){
            this.creep.moveTo(groupPoint)
            console.log("attacker escape")
        }

        if(this.creep.rangedAttack(this.target)==ERR_NOT_IN_RANGE){
            //最寄りに攻撃を試みる
            this.creep.rangedAttack(this.creep.findClosestByRange(enemyCreeps))
            this.creep.moveTo(this.target);
        }
    }
}

//脅威度評価
function calcEnemy(creep){
    var score = 0
    if(creep instanceof Creep && creep.body.some(b=>b.type==HEAL)) score += 10;
    score -= creep.hits / creep.hitsMax * 10;
    return score
}

//ヒール評価
function calcHeal(creep){
    var score = 0
    //HPが低い順
    score -= creep.hits / creep.hitsMax * 10;
    return score
}

const SQUAD_HEALER_COUNT = 2
const SQUAD_ATTACKER_COUNT = 3
const SQUAD_MEMBER_COUNT = SQUAD_ATTACKER_COUNT+SQUAD_HEALER_COUNT

const SQUAD_MODE_WAIT = 0
const SQUAD_MODE_ATTACK = 1

class soldier_squad{
    constructor() {
        this.attackers = [];
        this.healers = [];
        this.members = [];
        this.state = SQUAD_MODE_WAIT
        this.defend = true
        this.target
        this.waitPos = groupPoint;
    }

    trySpawn(){
        if(this.attackers.length<SQUAD_ATTACKER_COUNT){
            let holder = trySpawnAttacker();
            if(holder!=null){
                holder.squad = this
                this.attackers.push(holder)
                this.members.push(holder)

                return true
            }
        }
        if(this.healers.length<SQUAD_HEALER_COUNT){
            let holder = trySpawnHealer();
            if(holder!=null){
                holder.squad = this
                this.healers.push(holder)
                this.members.push(holder)
                return true
            }
        }
        return false
    }

    

    update(){
        this.attackers=this.attackers.filter(h=>!h.isDead())
        this.healers=this.healers.filter(h=>!h.isDead())
        this.members=this.members.filter(h=>!h.isDead())

        console.log(this.state,this.defend)

        if(this.isFull()){
            this.defend=false
        }

        //待機時
        if(this.state==SQUAD_MODE_WAIT){
            //防衛戦開始フラグ
            if(this.defend){
                if(0<enemySoldier.length&&getRange(mySpawn.findClosestByRange(enemySoldier),mySpawn)<20)
                    this.state=SQUAD_MODE_ATTACK
                else
                    this.attackers.forEach(atk=>atk.target=null)
            }else{
                if(this.isFull()){
                    this.state = SQUAD_MODE_ATTACK
                }
            }
        }
        if(this.state==SQUAD_MODE_ATTACK){
            if(this.attackers.length <= 0){
                this.state = SQUAD_MODE_WAIT
            }else{
                let leader = this.attackers[0].creep
                //進軍方向と付近の敵のみ
                let enemies = enemyCreeps.filter(e=>{
                    var r = 10;
                    if(isLeft)
                        if(leader.x<e.x) r = 20;
                    else
                        if(e.x<leader.x) r = 20;
                    if(getRange(e,leader)<r) return true;
                    return false
                })
                enemies.push(enemySpawn)

                var target = this.attackers[0].creep.findClosestByPath(enemies);
                console.log(target,enemies)

                //陣地に食いついたやつを殺す
                if(this.defend){
                    let enemy = mySpawn.findClosestByRange(enemySoldier)
                    if(getRange(mySpawn,enemy)<10)
                        target = enemy
                }

                if(target==null)
                    target=enemySpawn;
                else{
                    //最寄りの敵の近くのヒーラー
                    target = enemies.filter(enemy=>getRange(enemy, target)<2).sort((a,b) => calcEnemy(b) - calcEnemy(a))[0]
                }
                this.attackers.forEach(atk=>atk.target=target)
                this.healers.forEach(heal=>heal.target=this.attackers[0].creep)

                if(this.defend && getRange(mySpawn.findClosestByRange(enemySoldier),mySpawn)<30)
                    this.state = SQUAD_MODE_WAIT

                //if(attackers.length<SQUAD_ATTACKER_COUNT||healers.length<SQUAD_HEALER_COUNT)
            }
        }

        
        this.members.forEach(h=>h.update())
    }

    isFull(){
        return SQUAD_MEMBER_COUNT<=this.members.length
    }
    isEmpty(){
        return this.members.length == 0
    }
}

var isInit,mySpawn,enemySpawn;

var mySpawnHolder

var energy_workers=new creep_manager(null)


var squads=[]

var enemyCreeps=[]
var enemyAttacker=[]
var enemyRangeAttacker=[]
var enemyWorker=[]
var enemySoldier=[]

var myCreeps=[]
var myConstruct=[]

var groupPoint;

var isLeft

let trySpawnAttacker = function(){
    let creep = mySpawnHolder.trySpawn([MOVE,MOVE,RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK]);
    if(creep==null) return null
    return new attacker(creep)
};

let trySpawnHealer = function(){
    let creep = mySpawnHolder.trySpawn([MOVE,MOVE,HEAL,MOVE,HEAL,HEAL]);
    if(creep==null) return null
    return new healer(creep)
};


export function init(){
    
    mySpawn = getObjectsByPrototype(StructureSpawn).find(spawn=>spawn.my)
    enemySpawn = getObjectsByPrototype(StructureSpawn).find(spawn=>!spawn.my)

    mySpawnHolder = new spawn_holder(mySpawn)

    groupPoint={x: mySpawn.x, y: mySpawn.y+5}

    isLeft = mySpawn.x<50

    myConstruct.push(createConstructionSite({x: mySpawn.x, y: mySpawn.y-3},StructureRampart).object)

    squads.push(new soldier_squad())
}

export function loop() {
    if(!isInit){
        init();
        isInit=true;
    }

    enemyCreeps=getObjectsByPrototype(Creep).filter(creep=>!creep.my&&creep.hits!=null)
    myCreeps=getObjectsByPrototype(Creep).filter(creep=>creep.my)
    
    enemyAttacker = enemyCreeps.filter(creep=>creep.body.some(b=>b.type==ATTACK))
    enemyRangeAttacker = enemyCreeps.filter(creep=>creep.body.some(b=>b.type==RANGED_ATTACK))

    enemySoldier = enemyCreeps.filter(creep=>creep.body.some(b=>b.type==RANGED_ATTACK||b.type==ATTACK))
    enemyWorker = enemyCreeps.filter(creep=>creep.body.some(b=>b.type!=RANGED_ATTACK&&b.type!=ATTACK))


    if(0 < enemySoldier.length){
        let near = mySpawn.findClosestByRange(enemySoldier)
        if(getRange(near,mySpawn)<20)
            if(near.y<mySpawn.y)
                groupPoint.y = mySpawn.y+5
            else
                groupPoint.y = mySpawn.y-5
    }

    //==状況判断==
    //

    energy_workers.update()
    squads.forEach(sq=>sq.update())

    //エネルギー収集
    if(energy_workers.holders.length<1){
        let creep = mySpawnHolder.trySpawn([CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE]);
        if(creep!=null){
            energy_workers.holders.push(new energy_collector(creep))
        }
    }

    squads = squads.filter(sq=>!sq.isEmpty())
    
    squads.forEach(sq=>sq.trySpawn())

    var canSpawn = true;
    for(const sq of squads){
        if(sq.trySpawn()){
            canSpawn=false
            break
        }
        if(!sq.isFull())
            canSpawn = false;
    }
    if(canSpawn){
        let sq = new soldier_squad()
        if(sq.trySpawn()){
            sq.defend = true
            squads.push(sq)
            console.log("make new squad")
        }
    }
    // Your code goes here

}
