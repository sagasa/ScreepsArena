import { getObjectsByPrototype,getRange,findClosestByRange,createConstructionSite,findPath,getDirection,getTerrainAt,findInRange} from '/game/utils';
import { Creep, StructureSpawn ,StructureContainer,ConstructionSite,StructureTower,StructureRampart} from '/game/prototypes';
import {MOVE,ERR_NOT_ENOUGH_ENERGY ,RESOURCE_ENERGY,ERR_NOT_IN_RANGE,CARRY,ATTACK,RANGED_ATTACK,HEAL,WORK,TERRAIN_WALL,TERRAIN_SWAMP,TOUGH} from '/game/constants';
import {TOP,TOP_RIGHT,RIGHT,BOTTOM_RIGHT,BOTTOM,BOTTOM_LEFT,LEFT,TOP_LEFT} from '/game/constants';
import { } from '/arena';
import {CostMatrix,searchPath} from '/game/path-finder';

import {spawn_holder,creep_holder} from './creeps';
import {canMove,check3x3,move,getDirection4,clamp1} from './utils';
import * as ep from './enemies';
import * as creeps from './creeps';

//import {Visual} from '/game/visual';

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


let hunterMatrix = new CostMatrix
const MATRIX_HUNTER = {swampCost:2,costMatrix:hunterMatrix}

class hunter extends creep_holder{

    //横移動させる
    flank(pos){

    }

    //横移動のコスト計算
    calcFlank(){
 
    }

    update(){
        if(this.target==null){
            this.creep.moveTo(groupPoint)
            return
        }

        //回避行動
        let near = this.creep.findClosestByRange(enemyAttacker);
        if(near!=null&&getRange(this.creep,near)<3){
            this.creep.moveTo(mySpawn,NO_SWAMP)
            //let path = findPath(this.creep,mySpawn,MATRIX_HUNTER)
            //this.creep.moveTo(path[0])
            //this.creep.move(getDirection(this.creep.x - near.x,this.creep.y - near.y))
            //console.log("attacker escape")
        }

        if(this.creep.rangedAttack(this.target)==ERR_NOT_IN_RANGE){
            if(near==null||3<getRange(this.creep,near)){
                let path = findPath(this.creep,this.target,MATRIX_HUNTER)
                //this.creep.move(path)
                this.creep.moveTo(path[0])
                //横移動させる
                //console.log(findInRange(path[0], this.squad.members, 0))
                //this.creep.moveTo(this.target,NO_SWAMP); 
            }
            //最寄りに攻撃を試みる
            this.creep.rangedAttack(this.creep.findClosestByRange(enemyCreeps))
        }

        let damagedCreeps = this.squad.members.filter(i => i.creep.hits < i.creep.hitsMax).sort((a,b) => calcHeal(b.creep) - calcHeal(a.creep));
        if(damagedCreeps.length > 0) {
            if(this.creep.heal(damagedCreeps[0].creep) == ERR_NOT_IN_RANGE) {
                //レンジを適当に投げる
                this.creep.rangedHeal(damagedCreeps[0].creep)
            }
        }
    } 
}

let trySpawnHunter = function(){
    let creep = mySpawnHolder.trySpawn([MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,HEAL]);
    if(creep==null) return null
    return new hunter(creep)
};

const MEMBER_MODE_ATTACK = 0
const MEMBER_MODE_RETREAT = 1

class healer extends creep_holder{
    constructor(creep){
        super(creep)
        this.pos;
    }

    update(){
        if(this.target==null){
            this.creep.moveTo(groupPoint)
            return;
        }

        if(this.pos!=null){
            if(this.creep.x!=this.pos.x||this.creep.y!=this.pos.y){
                this.creep.moveTo(this.pos)
                console.log(this.creep.x,this.creep.y,this.pos)
            }
        }else{
            //回避行動
            let near = this.creep.findClosestByRange(enemyAttacker);
            if(near!=null&&getRange(this.creep,near)<2){
                this.creep.moveTo(groupPoint)
                console.log("healer escape")

            }else
                if(0<this.squad.attackers.length)
                    this.creep.moveTo(this.squad.leader.creep)
        }
        let damagedCreeps = this.squad.members.filter(i => i.creep.hits < i.creep.hitsMax).sort((a,b) => calcHeal(b.creep) - calcHeal(a.creep));
        if(damagedCreeps.length > 0) {
            if(this.creep.heal(damagedCreeps[0].creep) == ERR_NOT_IN_RANGE) {
                //レンジを適当に投げる
                this.creep.rangedHeal(damagedCreeps[0].creep)
            }
        }
    }
}

let attackerMatrix = new CostMatrix
const MATRIX_ATTACKER = {swampCost:8}

class attacker extends creep_holder{
    constructor(creep){
        super(creep)
        this.pos;
        this.moveOrder = false
        this.enemyRange = 0
    }

    //位置交換依頼
    yieldPos(holder){
        if(this.creep.x==this.pos.x&&this.creep.y==this.pos.y){
            //既に位置にいる場合
            if(typeof(holder)==typeof(this)){
                const index_this = this.squad.formation_atk.indexOf(this)
                const index_other = this.squad.formation_atk.indexOf(holder)
                const tmp = this.squad.formation_atk[index_this]
                this.squad.formation_atk[index_this] = this.squad.formation_atk[index_other]
                this.squad.formation_atk[index_other] = tmp

                this.creep.moveTo(holder.pos)
                this.moveOrder = true
                console.log("try yeild")
            }
        }
    }

    update(){
        if(this.target==null){
            this.creep.moveTo(groupPoint)
            
            return
        }

        if(this.pos!=null&&!this.moveOrder)
            if(this.creep.x!=this.pos.x||this.creep.y!=this.pos.y){
                const path = this.creep.findPathTo(this.pos,MATRIX_ATTACKER)

                const dep = this.squad.attackers.find(atk=>atk.creep.x==path[0].x&&atk.creep.y==path[0].y)
                if(dep!=null){
                    dep.yieldPos(this)
                    console.log("詰まった")
                }
                
                this.creep.moveTo(this.pos,MATRIX_ATTACKER)
                console.log(this.creep.x,this.creep.y,this.pos)
            }

        if(this.creep.attack(this.target)==ERR_NOT_IN_RANGE){
            //最寄りに攻撃を試みる
            this.creep.attack(this.creep.findClosestByRange(enemyCreeps))
            

            let path = searchPath(this.creep,this.target)
            this.enemyRange = path.cost

            if(this.pos==null){
                if(1<getRange(this.target,this.creep)){
                    this.creep.moveTo(path.path[0],MATRIX_ATTACKER);
                }
                for(const atk of this.squad.attackers){
                    if(atk!=this&&3<getRange(atk.creep,this.creep)&&this.enemyRange<atk.enemyRange)
                        this.creep.moveTo(atk.creep,MATRIX_ATTACKER)
                }
            }
            
            
        }
        this.moveOrder = false
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



//配列は破壊されます farがtrueなら一番遠いところに割り当てる(総合的な移動を最小にする)
function assign(holders,positions,far = false){
    const res = new Array(positions.length)
    for(const holder of holders) {
        let max_cost = null
        let max
        let max_index
        positions.forEach((pos, i) =>{
            if(pos==null)
                return
            const cost = searchPath(holder.creep,pos,MATRIX_ATTACKER).cost
            if(max_cost==null||(max<cost&&far)||(cost<max&&!far)){
                max_cost = cost
                max = pos
                max_index = i
            }
        })
        positions[max_index] = null
        holder.pos = max
        res[max_index] = holder
    }
    return res
}



const SQUAD_HEALER_COUNT = 2
const SQUAD_ATTACKER_COUNT = 4
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

        this.leader

        this.formation_center
        this.formation_dir
        this.formation_atk = []
        this.formation_heal = []

        this.frontPos
        
        this.waitPos = groupPoint;
    }

    trySpawn(){
        if(this.attackers.length<SQUAD_ATTACKER_COUNT){
            let holder = trySpawnAttacker();
            if(holder!=null){
                holder.squad = this
                if(this.attackers.length==0)
                    holder.leader = true;
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
                if(this.isFull()&&!this.members.some(m=>m.creep.hits/m.creep.hitsMax<0.9)){
                    this.state = SQUAD_MODE_ATTACK
                }
                this.attackers.forEach(atk=>atk.target=null)
            }
        }
        if(this.state==SQUAD_MODE_ATTACK){
            if(this.attackers.length <= 0){
                this.state = SQUAD_MODE_WAIT
            }else{
                let leader = this.attackers[0].creep
                //進軍方向と付近の敵のみ
                let enemies = enemySoldier.filter(e=>{
                    var r = 10;
                    if(isLeft)
                        if(leader.x<e.x) r = 20;
                    else
                        if(e.x<leader.x) r = 20;
                    if(getRange(e,leader)<r) return true;
                    return false
                })
                enemies.push(enemySpawn)

                let target = this.attackers[0].creep.findClosestByPath(enemies);
                // console.log(target,enemies)

                console.log("target near")
                let near;
                let vertical;
                for(const atk of this.attackers){
                    let dist = atk.enemyRange
                    if(near == null||atk.enemyRange<near.enemyRange){
                        near = atk
                    }
                }
                this.leader = near
                
                //運動機能ロス判定
                const enemyCantMove = enemies.every(e=>{
                    if(e.body==null)
                        return true
                    let max = 0,hit = 0
                    e.body.filter(b=>b.type==MOVE).forEach(b=>{
                        max += 100
                        hit += b.hits
                    })
                    return hit/max<0.3
                })

                const enemyNear = near.enemyRange<60&&getRange(near.creep,target)<10
                this.formationUpdate(enemyNear&&!enemyCantMove&&!(target instanceof StructureSpawn),target)

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
                    //target = enemies.filter(enemy=>getRange(enemy, target)<2).sort((a,b) => calcEnemy(b) - calcEnemy(a))[0]
                }
                this.attackers.forEach(atk=>atk.target=target)
                this.healers.forEach(heal=>heal.target=this.attackers[0].creep)
                this.members.forEach(mem=>mem.mode=MEMBER_MODE_ATTACK)
                
                if(this.defend){
                    if(getRange(mySpawn.findClosestByRange(enemySoldier),mySpawn)<30)
                        this.state = SQUAD_MODE_WAIT
                }//else
                    //if(this.members.some(m=>m.creep.hits/m.creep.hitsMax<0.7))
                    //    this.state=SQUAD_MODE_WAIT


                //if(attackers.length<SQUAD_ATTACKER_COUNT||healers.length<SQUAD_HEALER_COUNT)
            }
        }
        
        this.members.forEach(h=>h.update())
    }

    formationUpdate(use,target){
        if(!use){
            this.members.forEach(m=>m.pos=null)
            this.formation_center = null
            return
        }
        let far = false
        //陣形作成
        if(this.formation_center==null){
            far = true

            const near = this.attackers[0].creep
            //中央決定
            let canMove = check3x3(near)
            //陣形作成が不可能なら
            if(canMove.length==0)
                console.log("陣形作成が不可能")
            let center = canMove.length!=8 ? move(near,canMove[0]) : {x:near.x,y:near.y}
            this.formation_dir = getDirection4(target.x-center.x,target.y-center.y)
            this.formation_center = center
        }else{
            
            let hpSort = this.attackers.concat().sort((a,b)=>a.creep.hits-b.creep.hits)
            const minHP = hpSort[0]
            const sub = this.formation_atk[3]

            if(sub!=null&&sub!=minHP&&minHP.creep.hits/minHP.creep.hitsMax<0.5&&sub.canMove()&&minHP.canMove()){
                let pos = sub.pos
                sub.pos = minHP.pos
                sub.creep.moveTo(minHP.pos,MATRIX_ATTACKER)
                sub.moveOrder = true
                minHP.pos = pos
                minHP.creep.moveTo(pos,MATRIX_ATTACKER)
                minHP.moveOrder = true

                console.log("swap",this.formation_atk[3].creep.hits,minHP.creep.hits)
            }else if(!this.members.some(m=>!m.canMove())){
                let epos = target
                const isAttack = target.body.some(b=>b.type==ATTACK)
                if(isAttack){
                    const path = findPath(target,this.formation_center)
                    let epos = path[path.length-1]
                }

                console.log(epos)

                const adX = epos.x-this.formation_center.x,adY = epos.y-this.formation_center.y
                const dX = target.x-this.formation_center.x,dY = target.y-this.formation_center.y

                const range = getRange(this.formation_center,target)
                if(3<=range&&this.formation_dir!=getDirection4(dX,dY)){
                    //方向変更する
                    this.formation_dir = getDirection4(dX,dY)
                    console.log("rotate ",getRange(this.formation_center,target))
                }else if(2<=range){
                    //移動の必要があれば行う
                    let center
                    let back = findInRange(target,enemyAttacker,3)<4||!isAttack||3<range?-1:0
                    //back = (1<findInRange(target,enemySoldier,2).length&&range<3)?1:back
                    console.log("back",back,range)
                    if(this.formation_dir==LEFT||this.formation_dir==RIGHT)
                        center = {x:this.formation_center.x-clamp1(dX)*back,y:this.formation_center.y+clamp1(adY)}
                    else
                        center = {x:this.formation_center.x+clamp1(adX),y:this.formation_center.y-clamp1(dY)*back}

                    console.log(dX,dY)
                    let canMove = check3x3(center)
                    //陣形作成が不可能なら
                    if(canMove.length==0)
                        console.log("陣形作成が不可能")
                    center = canMove.length!=8 ? move(center,canMove[0]) : center

                    //結局動いたか
                    if(this.formation_center.x!=center.x||this.formation_center.y!=center.y){
                        console.log(this.formation_center,center)
                        this.formation_center = center
                    }
                }
            }else
                console.log("cant move now")

                    
        }

        if(this.formation_center==null)
            this.members.forEach(m=>m.pos=null)

        const center = this.formation_center
        const enemyDir = this.formation_dir
        const pos_atk = [
            center,
            move(center,(enemyDir+6)%8),
            move(center,(enemyDir+2)%8),
            move(center,(enemyDir+4)%8)]
        const pos_heal = [
            move(center,(enemyDir+3)%8),
            move(center,(enemyDir+5)%8)]

        this.formation_atk = assign(this.attackers.concat().sort(m=>getRange(center,m.creep)),pos_atk)
        this.formation_heal = assign(this.healers.concat().sort(m=>getRange(center,m.creep)),pos_heal)
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
    let creep = mySpawnHolder.trySpawn([MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK]);
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

let ec

export function loop() {
    if(!isInit){
        init();
        isInit=true;
    }



    creeps.update()
    ep.update()

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
    for(let y = 0; y < 100; y++) {
        for(let x = 0; x < 100; x++) {
            let tile = getTerrainAt({x: x, y: y});
            let weight =
                tile === TERRAIN_WALL  ? 255 : // wall  => unwalkable
                tile === TERRAIN_SWAMP ?   2 : // swamp => weight:  1
                                           2 ; // plain => weight:  1
            hunterMatrix.set(x, y, weight);
        }
    }
    enemyCreeps.forEach(c=>hunterMatrix.set(c.x,c.y,10))
    myCreeps.forEach(c=>hunterMatrix.set(c.x,c.y,10))


    energy_workers.update()
    squads.forEach(sq=>sq.update())

    if(!ec)
        ec=creeps.trySpawnEnergyCollector(mySpawnHolder)
    else
        ec.update()

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
