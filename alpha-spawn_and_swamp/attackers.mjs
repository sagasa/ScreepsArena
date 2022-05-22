import { getObjectsByPrototype,getRange,findClosestByRange,createConstructionSite,findPath,getDirection,getTerrainAt,findInRange,findClosestByPath} from '/game/utils';
import { Creep, StructureSpawn ,StructureContainer,ConstructionSite,StructureTower,StructureRampart} from '/game/prototypes';
import {MOVE,ERR_NOT_ENOUGH_ENERGY ,RESOURCE_ENERGY,ERR_NOT_IN_RANGE,CARRY,ATTACK,RANGED_ATTACK,HEAL,WORK,TERRAIN_WALL,TERRAIN_SWAMP,TOUGH} from '/game/constants';
import {TOP,TOP_RIGHT,RIGHT,BOTTOM_RIGHT,BOTTOM,BOTTOM_LEFT,LEFT,TOP_LEFT} from '/game/constants';
import { } from '/arena';
import {CostMatrix,searchPath} from '/game/path-finder';
import {Visual} from '/game/visual';

import {spawn_holder} from './utils';
import {check3x3,move,getDirection4,clamp1,entrySpawn} from './utils';
import * as util from './utils';

import * as ep from './enemies';
import * as cp from './creeps';
import * as mp from './maps';

let groupPoint ,isInit

function init(){
	let mySpawn = getObjectsByPrototype(StructureSpawn).find(spawn=>spawn.my)
    groupPoint={x: mySpawn.x, y: mySpawn.y+5}
    squad.formation_center = {x: mySpawn.x, y: mySpawn.y-5}
}

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
    matrixAttacker = ep.map.clone()

    cp.myCreeps.forEach(creep=>{
        matrixAttacker.set(creep.x, creep.y,8)
    })

    ep.creeps.forEach(creep=>{
        matrixAttacker.set(creep.x, creep.y,256)
    })

    cp.ownedStructures.forEach(os=>{
    	if(!(os instanceof StructureContainer)){
        	matrixAttacker.set(os.x, os.y,256)
        }
    })

    if(hound)
    	hound.update()
    else
    	trySpawnHound(5,creep=>hound=creep)

    return

    squad.update()
    squad.trySpawn()

    return
}
let hound
export function trySpawnHound(priority,callback){
	entrySpawn([MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,HEAL],priority,creep=>{

		creep.update = function(){

			let visual = new Visual(0,false)
			
			for (var x = -1; x <= 1; x++) {
				for (var y = -1; y <= 1; y++) {
					const px = this.x+x
					const py = this.y+y
					visual.text(matrixAttacker.get(px,py),{x:px,y:py},{font:0.4})
				}
			}

			const near = this.findClosestByRange(ep.soldiers)

			const nearEnemies = ep.soldiers.filter(creep=>getRange(creep,this)<10)
			let enemyPos = {x:this.x,y:this.y}
			nearEnemies.forEach(creep=>{
				const delta = {x:creep.x-this.x,y:creep.y-this.y}
				visual.circle(creep,{radius:0.4,opacity:0.2,fill:'#FF0000'})
				util.norm(delta)
				enemyPos.x += delta.x
				enemyPos.y += delta.y
			})

			const ex = this.x - enemyPos.x
			const ey = this.y - enemyPos.y
			const border = {x:this.x-ey,y:this.y+ex}
			

			if(0<nearEnemies.length)
				visual.circle(enemyPos,{radius:0.5,opacity:0.3,fill:'#FF0000'})
			//逃げるか引き撃ちか判定
			//ヒールレートで判断 TODO



			if(4<this.getRangeTo(near)&&this.hitsMax<this.hits+50){
				this.moveTo(near,ignoreSwamp)
				visual.line(this,near)
			}else if(this.getRangeTo(near)<4){
				//撤退する方向

				let ex = this.x - enemyPos.x
				let ey = this.y - enemyPos.y

				//後ろを抽出
				if(this.currentShield==null){
					visual.line(this,{x:this.x-ey,y:this.y+ex})
					const backIds = mp.bigIds.filter(id=>util.cross3(this,{x:this.x-ey,y:this.y+ex},mp.id2Center[id])<0)
					this.currentShield = util.getMin(backIds,(a,b)=>getRange(mp.id2Center[a],this)-getRange(mp.id2Center[b],this))
					
					visual.circle(nextMove,{radius:0.2,opacity:0.4,fill:'#F0F0F0'})
				}

				//敵が前にいるなら場所を変更
				if(nearEnemies.some(creep=>util.cross3(this,border,creep)<0)){
					console.log("前からくるぞ！！！")
					//ベクトル化
					let vec = util.sub(this,mp.id2Center[this.currentShield])
					//90°回す
					util.rotate90(vec)
					//座標化
					util.sum(this,vec,vec)

					mp.bigIds.forEach(id=>{
						//ベクトル化
						let vec = util.sub(this,mp.id2Center[id])
						//90°回す
						util.rotate90(vec)
						//正規化
						util.norm(vec)

						//visual.line(this,vec,{color:'#00F000'})

						//敵の数 180°1pt 120°2pt
						let enemyScore = 0
						id,nearEnemies.forEach(creep=>{
							const cross = util.cross(vec,util.norm(util.sub(creep,this)))
							if(0.5<cross){
								enemyScore += 2
							}else if(0<cross){
								enemyScore += 1
							}
						})
						//ベクトル化して正規化した
						console.log("enemyCount id",id,"score",enemyScore,"range",getRange(this,mp.id2Center[id]))
						
					})

					const backIds = mp.bigIds.filter(id=>util.cross3(this,vec,mp.id2Center[id])<0)
					this.currentShield = util.getMin(backIds,(a,b)=>getRange(mp.id2Center[a],this)-getRange(mp.id2Center[b],this))

					backIds.forEach(id=>{
						const pos = mp.id2Center[id]
						visual.circle(pos,{radius:0.2,opacity:0.4,fill:'#00F000'})
						
					})
				}

				console.log("currentShield ",this.currentShield,mp.id2Center[this.currentShield])

				let rPoint = this.getEscapePos(this.currentShield,enemyPos)
				console.log("back point ",rPoint)

				let epath = findPath(this, rPoint,ignoreSwamp)
				let nextMove = epath[0]
				
				this.moveTo(nextMove,ignoreSwamp)
				visual.line(this,rPoint,{color:'#0000F0'})
			}
			//console.log(matrixAttacker.get(this.x,this.y))
			
			this.heal(this)
			this.autoAttack(near)
	    }
 		creep.getEscapePos = function(backId,enemyPos){
 			let visual = new Visual(0,false)
	    	visual.circle(mp.id2Center[backId],{radius:0.2,opacity:0.4,fill:'#00F000'})
	    	let rPoint = {x:50,y:50}
			const convexRange = mp.getRangeConvex(backId,this)

			//触れているなら
			if(convexRange.dist<=1){

				const a = mp.getPointConvex(backId,convexRange.pos+0.2)
				const b = mp.getPointConvex(backId,convexRange.pos+0.8)
				//convexRange.pos
				const va = {x:a.x-this.x,y:a.y-this.y}
				const vb = {x:b.x-this.x,y:b.y-this.y}
		        const v0 = {x:enemyPos.x-this.x,y:enemyPos.y-this.y}
		        util.norm(va)
		        util.norm(vb)
				        
		        if(util.dot(va,v0)<util.dot(vb,v0)){
		        	rPoint = a
		        }else{
		        	rPoint = b
		        }
		        //console.log("次の移動位置")
			}else{
				//接点の中で最も安全なものを
				rPoint = util.getMin(mp.getTangentConvex(backId,this),(a,b)=>{
					const va = {x:a.x-this.x,y:a.y-this.y}
					const vb = {x:b.x-this.x,y:b.y-this.y}
		            const v0 = {x:enemyPos.x-this.x,y:enemyPos.y-this.y}
		            util.norm(va)
		            util.norm(vb)
		            const la = util.dot(va,v0)
		            const lb = util.dot(vb,v0)
		            return la - lb
				})
				//console.log("最良の接点",convexRange.dist)
			}
					
			mp.getTangentConvex(backId,this).forEach(a=>{
				const v0 = {x:a.x-this.x,y:a.y-this.y}
	            const v1 = {x:enemyPos.x-this.x,y:enemyPos.y-this.y}
	            util.norm(v0)
	            const l = util.dot(v0,v1)
	            //console.log("dot ",a,l)
	            visual.text(l,a,{font:0.4})
			})
			return rPoint
	    }

	    creep.autoAttack = function(target){
	    	if(target==null)
	    		return false
	    	if(getRange(target,this)<=1){
	    		this.rangedMassAttack()
	    		return true
	    	}
	    	return this.rangedAttack(target)==0
	    }
		callback(creep)
	})
}


const d2p = [{x:2,y:0,transpose:false},{x:0,y:2,transpose:true},{x:-2,y:0,transpose:false},{x:0,y:-2,transpose:true}]

const attackerIndexes = [{priority:5,indexes:[1,2,3]}]
const healerIndexes = [{priority:5,indexes:[6,7,8]}]
const rangedIndexes = [
	{priority:4,indexes:[1,2,3]},
	{priority:3,indexes:[0,6,7,8,4]},
	{priority:2,indexes:[5,11,12,13,9]}]
const rightIndexes = [1,6,11]
const leftIndexes = [3,8,13]
const frontIndexes = [1,2,3]

let matrixAttacker = new CostMatrix
const pathAttacker = {plainCost:1,swampCost:5,costMatrix:matrixAttacker}
const ignoreSwamp = {plainCost:1,swampCost:1,costMatrix:matrixAttacker}
const goSwamp = {plainCost:2,swampCost:1,costMatrix:matrixAttacker}

const RET_ASSIGN = 0
const RET_EMPTY = 1
const RET_FULL = 2

class attack_squad{

	constructor(){
		this.rangeAttackers = []
		this.attackers = []
		this.healers = []
		this.members = []

		this.formation_center
		this.formation_dir = RIGHT
		this.formation_pos = new Array(25)
		this.formation_state_pre = new Array(25)
		this.formation_state = new Array(25) //creep:実体,cost:コスト,priority:優先度
	}

	trySpawn(){
		if(this.rangeAttackers.length<5){
			const priority = this.rangeAttackers.length<3 ? 4 : 2
	        trySpawnRangeAttacker(priority,creep=>{
	        	this.rangeAttackers.push(creep)
	        	this.members.push(creep)
	        })       
	    }
		
		if(this.attackers.length<2){
			const priority = this.attackers.length<2 ? 4 : 3
	        trySpawnAttacker(priority,creep=>{
	        	this.attackers.push(creep)
	        	this.members.push(creep)
	        })
	    }

	    if(this.healers.length<3){
	    	const priority = this.healers.length<2 ? 4 : 3
	        trySpawnHealer(priority,creep=>{
	        	this.healers.push(creep)
	        	this.members.push(creep)
	        })
	    }
	}

	updateFormationPos(center){
		let dx = this.formation_dir==BOTTOM||this.formation_dir==LEFT ? 1:-1
    	let dy = this.formation_dir==TOP||this.formation_dir==LEFT ? 1:-1
    	let start = d2p[(this.formation_dir-1)/2]
    	let i = 0
    	for(let y = 0; y < 5; y++) {
	        for(let x = 0; x < 5; x++) {
	        	if(start.transpose){
	        		const rx = center.x + (y * dy) + start.x
	            	const ry = center.y + (x * dx) + start.y
	           		this.formation_pos[i] = {x:rx,y:ry}
	        	}else{
	        		const rx = center.x + (x * dx) + start.x
	            	const ry = center.y + (y * dy) + start.y
	           		this.formation_pos[i] = {x:rx,y:ry}
	        	}
	            i++
	        }
    	}
	}

	update(){
		this.rangeAttackers = this.rangeAttackers.filter(creep=>creep.hitsMax!=null)
	    this.attackers = this.attackers.filter(creep=>creep.hitsMax!=null)
	    this.healers = this.healers.filter(creep=>creep.hitsMax!=null)
	    this.members = this.members.filter(creep=>creep.hitsMax!=null)

	    let near = findClosestByPath(this.formation_center,ep.soldiers,pathAttacker)

	    //陣形をつくるか？
	    let assemble = near!=null&&getRange(this.formation_center,near)<10

	    if(near==null)
	    	near = ep.spawn

	    this.members.forEach(creep=>creep.target = near)
		//this.formation_state_prev = this.formation_state

		//優先度代入
		this.rangeAttackers.forEach(creep=>creep.priorityIndexes = rangedIndexes)
	    this.attackers.forEach(creep=>creep.priorityIndexes = attackerIndexes)
	    this.healers.forEach(creep=>creep.priorityIndexes = healerIndexes)


	    //次の位置の算出
	    let nextCenter = this.formation_center
	    if(2<=this.healers.length){
			let path

			//const dpath = findPath(this.formation_pos[18], near,ignoreSwamp)
			if(assemble){
				this.updateFormationPos(nextCenter)
				path = findPath(this.formation_center, near,ignoreSwamp)
				const dPos = this.formation_pos[7]
				if(2<path.length)
					this.formation_dir = getDirection4(path[1].x-dPos.x,path[1].y-dPos.y)

				let needRange = findInRange(near,ep.attackers,5).length!=0
				needRange = false
				if(needRange){
					//1マス残す
					if(2<getRange(path[0],near)){
						nextCenter = path[0]
					}
					//下がる
					if(getRange(path[0],near)<2){
						let epath = findPath(this.formation_center, groupPoint,ignoreSwamp)
						nextCenter = epath[0]
					}
				}else{
					if(1<getRange(path[0],near)){
						nextCenter = path[0]
					}
				}
				

			}else{
				path = findPath(this.formation_center, near,pathAttacker)
				nextCenter = path[0]
			}
			console.log(path[0],path[1])
			
			
			
		}
		let visual = new Visual(0,false)
		if(!assemble){
			if(4<findInRange(nextCenter,this.members,4).length){
				this.formation_center = nextCenter
			}
			this.members.forEach(creep=>creep.pos = this.formation_center)

		}else{
			this.updateFormationPos(nextCenter)

			if(!rightIndexes.every(index=>canMove(this.formation_pos[index]))){
				nextCenter = move(nextCenter,this.formation_dir+6)
				this.updateFormationPos(nextCenter)
			}
			if(!leftIndexes.every(index=>canMove(this.formation_pos[index]))){
				nextCenter = move(nextCenter,this.formation_dir+2)
				this.updateFormationPos(nextCenter)
			}
			

			

			attackerIndexes[0].indexes.forEach(index=>visual.circle(this.formation_pos[index], {radius:0.1,fill:'#00f0ff'}))
			rangedIndexes[2].indexes.forEach(index=>visual.circle(this.formation_pos[index], {radius:0.2,fill:'#f000ff'}))

			//マーク
			this.markCanMove()

			let oldState = this.formation_state
			//移動計算
			this.tryAssign()

			//最前列が形成できるか
			if(frontIndexes.every(index=>this.formation_state[index]!=null||!canMove(this.formation_pos[index]))){
				this.formation_center = nextCenter
			}else{
				console.log("GG recalc")
				this.updateFormationPos(this.formation_center)
				this.markCanMove()
				this.tryAssign()
				attackerIndexes[0].indexes.forEach(index=>visual.circle(this.formation_pos[index], {radius:0.1,fill:'#00f0ff'}))
				rangedIndexes[2].indexes.forEach(index=>visual.circle(this.formation_pos[index], {radius:0.2,fill:'#f000ff'}))
			}

			//代入
			this.formation_state.forEach((state,index)=>{
				if(state!=null)
					state.creep.pos = this.formation_pos[index]
			})
		}
		
		
		visual.circle(this.formation_center, {radius:0.3,fill:'#0000ff'})


		//console.log(this.formation_state_pre)

		//this.rangeAttackers.forEach(creep=>creep.tryAssign())
	    //this.attackers.forEach(creep=>creep.tryAssign())
	    //this.healers.forEach(creep=>creep.tryAssign())

	   

		this.rangeAttackers.forEach(creep=>creep.update())
	    this.attackers.forEach(creep=>creep.update())
	    this.healers.forEach(creep=>creep.update())

	    this.members.forEach(creep=>{
	    	visual.line(creep,creep.pos)
	    	visual.text(creep.id,creep,{font:"0.5"})
	    })
	}

	tryYield(targetIndex,from,originPriority,fromList){
		const target = this.formation_state[targetIndex]
		const creep = target.creep
		//循環したなら失敗
		if(fromList.includes(creep))
			return false
		fromList.push(creep)
		const currentPriority = target.priority
		console.log(creep.id,"tryYield from",from.id,this.formation_pos[targetIndex],originPriority)

		//yieldしなくていい方法を探すため2パス
		let lastPriorityIndex = 0,lastPriority = null,firstPass = false
		for (var i = 0; i <= creep.posEntries.length; i++) {
			const entry = creep.posEntries[i]
			if(creep.posEntries.length==i||lastPriority==null||lastPriority<entry.priority){
				//１パス目ならもう１回
				if(firstPass){
					console.log("rewind ",lastPriorityIndex,lastPriority)
					i = lastPriorityIndex - 1
					firstPass = false
					continue
				}
				
				if(creep.posEntries.length==i)
					break

				lastPriority = entry.priority
				lastPriorityIndex = i
				firstPass = true
			}

			//現在の優先度より下がるなら実行しない
			if(entry.priority<currentPriority&&originPriority<=currentPriority){
				console.log(creep.id,"yield faild",from.id,this.formation_pos[targetIndex])
				return false
			}
			//console.log("pass ",entry.priority,firstPass)
			const index = entry.index
			const entries = this.formation_state_pre[index]
			const pos = this.formation_pos[index]
			const state = this.formation_state[index]
			const range = entry.range

			if(targetIndex==index)
				continue

			if(state!=null){
				//優先できないor依頼元or１パス目ならスキップ
				if(firstPass||state.creep==from||!this.tryYield(index,creep,originPriority,fromList))
					continue;
			}
			this.formation_state[index] = {creep:creep,range:range,priority:entry.priority}
			console.log(creep.id,"assign",pos.x,pos.y,entry.priority,range)
			return true
		}
		console.log(creep.id,"yield faild",from.id,this.formation_pos[targetIndex])
		return false
	}

	tryAssign(){
		//ステートの初期化
		this.formation_state = new Array(25)

		for(const creep of this.members){
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
						if(!this.tryYield(index,creep,entry.priority,[]))
							continue 
						//console.log(creep.id,"被った",state.creep.id)
					}
					this.formation_state[index] = {creep:creep,range:range,priority:entry.priority}
					console.log(creep.id,"assign",pos.x,pos.y,entry.priority,range)
					break ;
				}
			}else{
				loop_out:
				for(const pIndexes of creep.priorityIndexes){
					for(const index of pIndexes.indexes){
						const pos = this.formation_pos[index]
						const entries = this.formation_state_pre[index]
						if(entries==null||entries.every(d=>d.creep==creep||d.priority<=pIndexes.priority)){
							creep.pos = this.formation_pos[index]
							//console.log(creep.id,"move",pos.x,pos.y,pIndexes.priority,getRange(creep,pos))
							break loop_out;
						}
					}
				}
			}
		}
	}

	markCanMove(){
		//移動情報の初期化
		this.formation_state_pre = new Array(25)
		this.members.forEach(creep=>creep.posEntries = [])

		this.members.forEach(creep=>{
			creep.priorityIndexes.forEach(pIndexes=>{
				
				//入れる場所の数を出す
				let count = 0
				pIndexes.indexes.forEach(index=>{
					const pos = this.formation_pos[index]
					if(!canMove(pos))
						return
					const range = getRange(creep,pos)
					if(range==0||creep.fatigue<=0&&range<=1){
						count++
					}
				})

				pIndexes.indexes.forEach(index=>{
					const pos = this.formation_pos[index]
					if(!canMove(pos))
						return
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


const squad = new attack_squad()

function canMove(pos){
	return getTerrainAt({x: pos.x, y: pos.y})!=1&&matrixAttacker.get(pos.x,pos.y)<100
}



export function trySpawnHealer(priority,callback){
	entrySpawn([MOVE,MOVE,HEAL,MOVE,HEAL,HEAL],priority,creep=>{

		creep.priorityIndexes = healerIndexes

		creep.pos = groupPoint

		creep.update = function(){
	        this.moveTo(this.pos,pathAttacker)
	        let damagedCreeps = squad.members.filter(i => i.hits < i.hitsMax).sort((a,b) => calcHeal(b) - calcHeal(a));
	        if(damagedCreeps.length > 0) {
	            if(this.heal(damagedCreeps[0]) == ERR_NOT_IN_RANGE) {
	                //レンジを適当に投げる
	                this.rangedHeal(damagedCreeps[0])
	            }
	        }
	    }
		callback(creep)
	})
}

//ヒール評価
function calcHeal(creep){
    var score = 0
    //HPが低い順
    score -= creep.hits / creep.hitsMax * 10;
    return score
}

export function trySpawnAttacker(priority,callback){
	entrySpawn([MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK],priority,creep=>{

		creep.priorityIndexes = attackerIndexes

		creep.pos = groupPoint

		creep.update = function(){

			this.moveTo(this.pos,pathAttacker)
			if(this.attack(this.target)==ERR_NOT_IN_RANGE){
	            //最寄りに攻撃を試みる
	            this.attack(this.findClosestByRange(ep.creeps))
	        }
    	}

    	callback(creep)
	})
}

export function trySpawnRangeAttacker(priority,callback){
	entrySpawn([MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,MOVE],priority,creep=>{

		creep.priorityIndexes = rangedIndexes

		creep.pos = groupPoint

		creep.update = function(){
			this.moveTo(this.pos,pathAttacker)
			if(this.target==null||!this.autoAttack(this.target)){
				const near = this.findClosestByRange(ep.creeps)
				this.autoAttack(near)
			}
	    }

	    creep.autoAttack = function(target){
	    	if(target==null)
	    		return false
	    	if(getRange(target,this)<=1){
	    		this.rangedMassAttack()
	    		return true
	    	}
	    	return this.rangedAttack(target)==0
	    }

		callback(creep)
	})
}