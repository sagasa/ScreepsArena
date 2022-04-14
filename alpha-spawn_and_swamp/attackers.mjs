import { getObjectsByPrototype,getRange,findClosestByRange,createConstructionSite,findPath,getDirection,getTerrainAt,findInRange} from '/game/utils';
import { Creep, StructureSpawn ,StructureContainer,ConstructionSite,StructureTower,StructureRampart} from '/game/prototypes';
import {MOVE,ERR_NOT_ENOUGH_ENERGY ,RESOURCE_ENERGY,ERR_NOT_IN_RANGE,CARRY,ATTACK,RANGED_ATTACK,HEAL,WORK,TERRAIN_WALL,TERRAIN_SWAMP,TOUGH} from '/game/constants';
import {TOP,TOP_RIGHT,RIGHT,BOTTOM_RIGHT,BOTTOM,BOTTOM_LEFT,LEFT,TOP_LEFT} from '/game/constants';
import { } from '/arena';
import {CostMatrix,searchPath} from '/game/path-finder';
import {Visual} from '/game/visual';

import {spawn_holder} from './utils';
import {canMove,check3x3,move,getDirection4,clamp1,entrySpawn} from './utils';

import * as ep from './enemies';
import * as cp from './creeps';

let groupPoint ,isInit

function init(){
	let mySpawn = getObjectsByPrototype(StructureSpawn).find(spawn=>spawn.my)
    groupPoint={x: mySpawn.x, y: mySpawn.y+5}
}

const d2p = [{x:2,y:0,transpose:false},{x:0,y:2,transpose:true},{x:-2,y:0,transpose:false},{x:0,y:-2,transpose:true}]

const attackerIndexes = [{priority:5,indexes:[1,2,3]}]
const healerIndexes = [{priority:5,indexes:[6,7,8]}]
const rangedIndexes = [
	{priority:4,indexes:[1,2,3]},
	{priority:3,indexes:[0,6,7,8,4]},
	{priority:2,indexes:[5,11,12,13,9]}]
const rightIndex = [1,6,11]
const leftIndex = [3,8,13]

const matrixAttacker = new CostMatrix
const pathAttacker = {plainCost:1,swampCost:5,costMatrix:matrixAttacker}

const RET_ASSIGN = 0
const RET_EMPTY = 1
const RET_FULL = 2

class attack_squad{

	constructor(){
		this.rangeAttackers = []
		this.attackers = []
		this.healers = []
		this.members = []

		this.formation_center = {x:6,y:35}
		this.formation_dir = RIGHT
		this.formation_pos = new Array(25)
		this.formation_state_pre = new Array(25)
		this.formation_state = new Array(25) //creep:実体,cost:コスト,priority:優先度
	}

	trySpawn(){
		if(this.rangeAttackers.length<4){
	        trySpawnRangeAttacker(4,creep=>{
	        	this.rangeAttackers.push(creep)
	        	this.members.push(creep)
	        })       
	    }
		
		if(this.attackers.length<2){
	        trySpawnAttacker(4,creep=>{
	        	this.attackers.push(creep)
	        	this.members.push(creep)
	        })
	    }

	    if(this.healers.length<2){
	        trySpawnHealer(4,creep=>{
	        	this.healers.push(creep)
	        	this.members.push(creep)
	        })
	    }
	}

	update(){
		this.rangeAttackers = this.rangeAttackers.filter(creep=>creep.hitsMax!=null)
	    this.attackers = this.attackers.filter(creep=>creep.hitsMax!=null)
	    this.healers = this.healers.filter(creep=>creep.hitsMax!=null)
	    this.members = this.members.filter(creep=>creep.hitsMax!=null)

		const center = this.formation_state[2]
		if(center!=null&&this.healers.length==2&&this.members.every(creep=>creep.fatigue<=0)){
			const path = findPath(this.formation_center, ep.spawn,pathAttacker)
			this.formation_center = path[0]
			console.log(path[0],path[1])
		}

		//this.formation_state_prev = this.formation_state
		//移動情報の初期化
		this.formation_state_pre = new Array(25)
		this.formation_state = new Array(25)
		this.members.forEach(creep=>creep.posEntries = [])


    	let dx = this.formation_dir==BOTTOM||this.formation_dir==LEFT ? 1:-1
    	let dy = this.formation_dir==TOP||this.formation_dir==LEFT ? 1:-1
    	let start = d2p[(this.formation_dir-1)/2]
    	let i = 0
    	for(let y = 0; y < 5; y++) {
	        for(let x = 0; x < 5; x++) {
	        	if(start.transpose){
	        		const rx = this.formation_center.x + (y * dy) + start.x
	            	const ry = this.formation_center.y + (x * dx) + start.y
	           		this.formation_pos[i] = {x:rx,y:ry}
	        	}else{
	        		const rx = this.formation_center.x + (x * dx) + start.x
	            	const ry = this.formation_center.y + (y * dy) + start.y
	           		this.formation_pos[i] = {x:rx,y:ry}
	        	}
	            i++
	        }
    	}

		
		let visual = new Visual(0,false)

		attackerIndexes[0].indexes.forEach(index=>visual.circle(this.formation_pos[index], {radius:0.1,fill:'#00f0ff'}))
		rangedIndexes[2].indexes.forEach(index=>visual.circle(this.formation_pos[index], {radius:0.2,fill:'#f000ff'}))
		

		visual.circle(this.formation_center, {radius:0.3,fill:'#0000ff'})

		//優先度代入
		this.rangeAttackers.forEach(creep=>creep.priorityIndexes = rangedIndexes)
	    this.attackers.forEach(creep=>creep.priorityIndexes = attackerIndexes)
	    this.healers.forEach(creep=>creep.priorityIndexes = healerIndexes)

		//マーク
		this.markCanMove()

		//移動
		this.moveToEmpty(this.attackers,attackerIndexes)
		this.moveToEmpty(this.rangeAttackers,rangedIndexes)
		this.moveToEmpty(this.healers,healerIndexes)

		//console.log(this.formation_state_pre)

		//this.rangeAttackers.forEach(creep=>creep.tryAssign())
	    //this.attackers.forEach(creep=>creep.tryAssign())
	    //this.healers.forEach(creep=>creep.tryAssign())

	   

		this.rangeAttackers.forEach(creep=>creep.update())
	    this.attackers.forEach(creep=>creep.update())
	    this.healers.forEach(creep=>creep.update())

	    this.members.forEach(creep=>{
	    	visual.line(creep,creep.target)
	    	visual.text(creep.id,creep,{font:"0.5"})
	    })
	}

	tryYield(target,targetIndex,from){
		const creep = target.creep
		const currentPriority = target.priority
		console.log(creep.id,"tryYield from",from.id,this.formation_pos[targetIndex])
		for(const entry of creep.posEntries){
			//現在の優先度より下がるなら実行しない
			if(entry.priority<currentPriority){
				console.log(creep.id,"yield faild",from.id,this.formation_pos[targetIndex])
				return false
			}

			const index = entry.index
			const entries = this.formation_state_pre[index]
			const pos = this.formation_pos[index]
			const state = this.formation_state[index]
			const range = entry.range

			if(targetIndex==index)
				continue

			if(state!=null){
				//優先できないor依頼元ならスキップ
				if(state.creep==from||!this.tryYield(state,index,creep))
					continue;
			}
			this.formation_state[index] = {creep:creep,range:range,priority:entry.priority}
			creep.target = pos
			creep.index = index
			console.log(creep.id,"assign",pos.x,pos.y,entry.priority,range)
			return true
		}
		return false
	}

	moveToEmpty(creeps,priorityIndexes){
		for(const creep of creeps){
			if(0<creep.posEntries.length){
				creep.posEntries.sort((a,b)=>{
					if(b.priority==a.priority)
						return a.range-b.range
					else
						return b.priority-a.priority
				})
				for(const entry of creep.posEntries){
					const index = entry.index
					const entries = this.formation_state_pre[index]
					const pos = this.formation_pos[index]
					const state = this.formation_state[index]
					const range = entry.range

					if(state!=null){
						if(!this.tryYield(state,index,creep))
							continue 
						//console.log(creep.id,"被った",state.creep.id)
					}
					this.formation_state[index] = {creep:creep,range:range,priority:entry.priority}
					creep.target = pos
					creep.index = index
					console.log(creep.id,"assign",pos.x,pos.y,entry.priority,range)
					break ;
				}
			}else{
				loop_out:
				for(const pIndexes of priorityIndexes){
					for(const index of pIndexes.indexes){
						const pos = this.formation_pos[index]
						const entries = this.formation_state_pre[index]
						if(entries==null||entries.every(d=>d.creep==creep||d.priority<=pIndexes.priority)){
							creep.target = this.formation_pos[index]
							console.log(creep.id,"move",pos.x,pos.y,pIndexes.priority,getRange(creep,pos))
							break loop_out;
						}
					}
				}
			}
		}

		creeps.forEach(creep=>{
			
		})
	}

	markCanMove(){
		this.members.forEach(creep=>{
			creep.priorityIndexes.forEach(pIndexes=>{
				
				//入れる場所の数を出す
				let count = 0
				pIndexes.indexes.forEach(index=>{
					const pos = this.formation_pos[index]
					const range = getRange(creep,pos)
					if(range==0||creep.fatigue<=0&&range<=1){
						count++
					}
				})

				pIndexes.indexes.forEach(index=>{
					const pos = this.formation_pos[index]
					const range = getRange(creep,pos)
					if(range==0||creep.fatigue<=0&&range<=1){
						if(this.formation_state_pre[index]==null)
							this.formation_state_pre[index]=[]
						//console.log(creep.id,"mark",pos.x,pos.y,pIndexes.priority,range,count==1)
						this.formation_state_pre[index].push({priority:pIndexes.priority,creep:creep,range:range,need:count==1})
						creep.posEntries.push({priority:pIndexes.priority,index:index,range:range,need:count==1})
					}
				})
			})
		})
	}

	
}



const tryAssign = function (){
	

    loop_out:
    for(const pIndexes of this.priorityIndexes){
    	if(false&&this.index!=null){
			const lastData = squad.formation_state_prev[this.index]
			if(lastData!=null&&lastData.creep.id==this.id&&pIndexes.priority==lastData.priority&&squad.tryAssign(this,pIndexes.priority,this.index)){
		    	return
		    }
		}
		let flag = false
    	loop_in:
    	for(const index of pIndexes.indexes){
    		const ret = squad.tryAssign(this,pIndexes.priority,index)
    		if(ret == RET_ASSIGN){
    			//割り当てたら終了
    			break loop_out
    		}else if(ret==RET_EMPTY){
    			//その優先度未満は見なくていい
    			flag = true
    		}
    	}
    	if(flag)
    		break
    }
}


const squad = new attack_squad()



export function update(){
	if(!isInit){
        init();
        isInit=true;
    }
    for(let y = 0; y < 100; y++) {
        for(let x = 0; x < 100; x++) {
            matrixAttacker.set(x,y,0)
        }
    } 
    cp.myCreeps.forEach(creep=>{
        matrixAttacker.set(creep.x, creep.y,8)
    })

    squad.update()
    squad.trySpawn()

    return
}

export function trySpawnHealer(priority,callback){
	entrySpawn([MOVE,MOVE,HEAL,MOVE,HEAL,HEAL],priority,creep=>{

		creep.tryAssign = tryAssign
		creep.priorityIndexes = healerIndexes

		creep.target = groupPoint

		creep.update = function(){
	        this.moveTo(this.target,pathAttacker)
	    }
		callback(creep)
	})
}

export function trySpawnAttacker(priority,callback){
	entrySpawn([MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK],priority,creep=>{

		creep.tryAssign = tryAssign
		creep.priorityIndexes = attackerIndexes

		creep.target = groupPoint

		creep.update = function(){

			this.moveTo(this.target,pathAttacker)
    	}

    	callback(creep)
	})
}

export function trySpawnRangeAttacker(priority,callback){
	entrySpawn([MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,MOVE],priority,creep=>{

		creep.tryAssign = tryAssign
		creep.priorityIndexes = rangedIndexes

		creep.target = groupPoint

		creep.update = function(){
			this.moveTo(this.target,pathAttacker)

			return
			const near = this.findClosestByPath(ep.soldier,pathAttacker)
			if(this.rangedAttack(near)==ERR_NOT_IN_RANGE)
        		this.moveTo(near,pathAttacker)
	    }

		callback(creep)
	})
}