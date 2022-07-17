import {getTerrainAt } from '/game/utils';
import {Creep,StructureSpawn,StructureRoad,StructureExtension} from '/game/prototypes';
import {ATTACK,RANGED_ATTACK,HEAL,WORK,CARRY,MOVE,TERRAIN_WALL} from '/game/constants';
import { } from '/arena';
import {Visual} from '/game/visual';
import {CostMatrix,searchPath} from '/game/path-finder';
import { getObjectsByPrototype,getRange,getTicks } from '/game/utils';

import * as cp from './creeps';

class creep_profiler{

	constructor(creep){
		//移動計測用
		this.lastPos={x:creep.x,y:creep.y}
		this.lastMoveTick
		this.weight
		this.lastNearPos = {}
		this.targetCreeps = []
	}
	update(creep){

		const moveLastTick = creep.x!=this.lastPos.x||creep.y!=this.lastPos.y
		if(moveLastTick){
			this.lastMoveTick = getTicks()
			//console.log('move',this.lastMoveTick)
		}

		//機動力計測
		let moveCount = creep.body.filter(b=>b.type==MOVE&&0<b.hits).length
		let otherCount = creep.body.filter(b=>b.type!=MOVE&&b.type!=CARRY&&0<b.hits).length

		creep.moveTickSwamp = Math.ceil(otherCount/moveCount*5)
		creep.moveTickPlane = Math.ceil(otherCount/moveCount)
		creep.canMove = creep.fatigue <= 0 && 0 < moveCount
		creep.moveTimer = Math.ceil(creep.fatigue / moveCount / 2)

		//攻撃性計測
		
		if(creep.body.some(b=>b.type==RANGED_ATTACK&&0<b.hits)){
			//遠距離持ち
			if(creep.canMove)
				creep.dangerRadius = 4
			else
				creep.dangerRadius = 3
		}else if(creep.body.some(b=>b.type==ATTACK&&0<b.hits)){
			//近接持ち
			creep.dangerRadius = 3
		}
		
		//ターゲットの推定
		//候補
		const nearCreeps = cp.creeps.filter(c=>getRange(creep,c)<=10)
		if(moveLastTick&&creep.body.some(b=>b.type==ATTACK||b.type==RANGED_ATTACK)){
			//攻撃可能&&前tickで動いたなら
			this.targetCreeps = nearCreeps.filter(c=>{
				const lastPos = this.lastNearPos[c.id]
				if(lastPos == null)
					return false
				return getRange(creep,lastPos)<getRange(this.lastPos,lastPos)
			})
		}

		//ターゲットがあるなら出力
		if(0<this.targetCreeps.length)
			console.log(`taget ${creep.id} => ${this.targetCreeps.map(c=>'id:'+c.id)}`)

		//次tick用に登録
		this.lastNearPos = {}
		nearCreeps.forEach(c=>this.lastNearPos[c.id]={x:c.x,y:c.y})
		
		

		

		//console.log("move tick",this.moveTickSwamp,this.moveTickPlane,this.canMove)

		this.lastPos = {x:creep.x,y:creep.y}
	}
}

export let extensions=[]
export let spawn

export let creeps=[]
export let attackers=[]
export let rangedAttackers=[]
export let healers=[]
export let workers=[]
export let transporters=[]
export let soldiers=[]
export let damageDealer=[]

export let map = new CostMatrix()

let isInit,sideLeft

function init(){
	spawn = getObjectsByPrototype(StructureSpawn).find(spawn=>!spawn.my)
	sideLeft = spawn.x<50	
}

export function update(){
	if(!isInit){
        init();
        isInit=true;
    }
	
    extensions = getObjectsByPrototype(StructureExtension).filter(os=>!os.my)

	creeps = getObjectsByPrototype(Creep).filter(creep=>!creep.my&&creep.hits!=null)
	creeps.forEach(creep=>{
		if(!creep.profiler)
			creep.profiler = new creep_profiler(creep)
		creep.profiler.update(creep)
	})

    attackers = creeps.filter(creep=>creep.body.some(b=>b.type==ATTACK))
    rangedAttackers = creeps.filter(creep=>creep.body.some(b=>b.type==RANGED_ATTACK))
    healers = creeps.filter(creep=>creep.body.some(b=>b.type==HEAL))

    soldiers = attackers.concat(rangedAttackers,healers)
    damageDealer = attackers.concat(rangedAttackers)

    workers = creeps.filter(creep=>creep.body.some(b=>b.type==WORK))
    transporters = creeps.filter(creep=>creep.body.some(b=>b.type==CARRY))

    let visual = new Visual(0,false)


    //敵の数
    visual.text('soldier count '+soldiers.length,{x:10,y:-8},{font:1.4,color:'#00F000'})
    visual.text('attacker count '+attackers.length,{x:10,y:-6},{font:1.4,color:'#00F000'})
    visual.text('rangedAttacker count '+rangedAttackers.length,{x:10,y:-4},{font:1.4,color:'#00F000'})
    visual.text('healer count '+healers.length,{x:10,y:-2},{font:1.4,color:'#00F000'})

    visual.text('workers count '+workers.length,{x:40,y:-8},{font:1.4,color:'#00F000'})
    visual.text('transporters count '+transporters.length,{x:40,y:-6},{font:1.4,color:'#00F000'})

    //脅威度Map作成
    map = new CostMatrix()
    rangedAttackers.forEach(creep=>{
    	if(creep.canMove){
    		paint(creep,3,1,15)

    	}else{
    		paint(creep,3,0,15)
    	}
    	//visual.text(map.get(creep.x,creep.y),creep,{font:0.3})
    })

    attackers.forEach(creep=>{
    	if(creep.canMove){
    		paint(creep,1,1,20)

    	}else{
    		paint(creep,1,0,20)
    	}
    })

    
    

    //交戦エリア
    //visual.rect(centerArea,centerArea.w,centerArea.h,{opacity:0.1})
    //visual.rect(mySpawnArea,mySpawnArea.w,mySpawnArea.h,{opacity:0.1,fill:'#00f000'})
    //visual.rect(enemySpawnArea,enemySpawnArea.w,enemySpawnArea.h,{opacity:0.1,fill:'#f00000'})

    //敵陣地
    visual.circle(spawn,{radius:8,opacity:0.1,fill:'#F00000'})
}

function paint(center,size,ext,weight){
	const total = size + ext
	let visual = new Visual(0,false)
	if(0 < ext)
		visual.rect({x:center.x-total-0.4,y:center.y-total-0.4},total*2+0.8,total*2+0.8,{opacity:0.1,fill:'#F0F000',stroke :'#FFF000'})
	visual.rect({x:center.x-size-0.4,y:center.y-size-0.4},size*2+0.8,size*2+0.8,{opacity:0.1,fill:'#F0F000',stroke :'#F00000'})
	for (let x = center.x - total; x <= center.x + total; x++) {
		for (let y = center.y - total; y <= center.y + total; y++) {
			map.set(x,y,weight)
		}	
	}
}