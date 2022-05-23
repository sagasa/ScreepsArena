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
}

let matrixAttacker = new CostMatrix

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
    //matrixAttacker = ep.map.clone()

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


    if(hound&&hound.hitsMax){
    	hound.update()
    }else
    	trySpawnHound(5,creep=>hound=creep)

    if(killer&&hound.hitsMax)
    	killer.update()
    else if(0<ep.workers.length)
    	trySpawnKiller(4,creep=>killer=creep)

    
    healers = healers.filter(creep=>creep.hitsMax)
    healers.forEach(et=>et.update())
    if(healers.length<2){
        const priority = healers.length<=2 ? 4 : 3
        trySpawnHealer(priority,(creep)=>healers.push(creep))
    }

    rangedAttackers = rangedAttackers.filter(creep=>creep.hitsMax)
    rangedAttackers.forEach(et=>et.update())
    if(rangedAttackers.length<2){
        const priority = rangedAttackers.length<=2 ? 4 : 3
        trySpawnRangedAttacker(priority,(creep)=>rangedAttackers.push(creep))
    }
}

let rangedAttackers = []
export function trySpawnRangedAttacker(priority,callback){
	entrySpawn([MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK],priority,creep=>{

		creep.update = function(){

			let visual = new Visual(0,false)


			//移動速度計算
			const moveCount = this.body.filter(b=>b.type==MOVE&&0<b.hits).length
			const otherCount = this.body.filter(b=>b.type!=MOVE&&0<b.hits).length
			const moveTickSwamp = Math.ceil(otherCount/moveCount*5)
			const moveTickPlane = Math.ceil(otherCount/moveCount)
			const pathProp = {plainCost:moveTickPlane,swampCost:moveTickSwamp,costMatrix:matrixAttacker}

			//敵位置算出
			const nearEnemies = ep.soldiers.filter(creep=>getRange(creep,this)<15)
			let near = this.findClosestByRange(ep.soldiers)

			let bad = false
			let hp = 0
			let heal = 0
			nearEnemies.forEach(creep=>{
				const res = searchPath(creep,{pos:this,range:1},{plainCost:creep.moveTickPlane,swampCost:creep.moveTickSwamp,maxCost:12})
				visual.text(creep.moveTickSwamp+' '+res.incomplete+' '+res.cost,creep,{font:0.4})

				creep=>creep.body.filter(b=>b.type==HEAL&&0<b.hits).forEach(b=>heal+=12)
				if(res.incomplete==false&&res.cost<11){
					bad = true
				}
			})
			visual.text(heal+' '+hp,this,{font:0.4})


			//ないなら敵スポーン
			if(near==null)
				near = ep.spawn

			//逃げるか引き撃ちか判定
			const fullHP = this.hitsMax<this.hits+50
			const inDanger = nearEnemies.some(creep=>getRange(this,creep)<creep.dangerRadius)
			const inSafe = nearEnemies.every(creep=>creep.dangerRadius<getRange(this,creep))

			if(!bad){
				this.moveTo(near,pathProp)
				visual.line(this,near)
			}else{

				let rPoint = this.getEscapePos()
				//console.log("back point ",rPoint)

				let epath = findPath(this, rPoint,pathProp)
				let nextMove = epath[0]
				
				let prev = this
				for (var i = 0; i < epath.length&&i<5; i++) {
					visual.line(prev,epath[i],{color:'#0000F0',opacity:0.2})
					prev = epath[i]
				}
				
				this.moveTo(nextMove,pathProp)
				visual.line(this,rPoint,{color:'#0000F0',lineStyle:'dotted',opacity:0.2})
			}
			//console.log(matrixAttacker.get(this.x,this.y))
			
			if(!this.autoAttack(near)){
				this.autoAttack(findClosestByRange(this,ep.creeps))
			}
	    }

 		creep.getEscapePos = calcEscapePos

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

let healers = []
export function trySpawnHealer(priority,callback){
	entrySpawn([MOVE,MOVE,MOVE,HEAL,HEAL,HEAL],priority,creep=>{
		creep.update = function(){
	        
	    }
		callback(creep)
	})
}

let killer
export function trySpawnKiller(priority,callback){
	entrySpawn([MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK],priority,creep=>{

		creep.update = function(){
			let workers = ep.workers.filter(creep=>ep.centerArea.contain(creep)&&inSafe(creep))
			let transporters = ep.transporters.filter(creep=>ep.centerArea.contain(creep)&&inSafe(creep))
			let extensions = ep.extensions.filter(ext=>inSafe(ext))

			let near = findClosestByRange(this,workers)
			if(near==null)
				near = findClosestByRange(this,extensions)
			if(near==null)
				near = findClosestByRange(this,transporters)

			this.moveTo(near)
			if(this.attack(near)==ERR_NOT_IN_RANGE){
	            //最寄りに攻撃を試みる
	            this.attack(this.findClosestByRange(ep.creeps))
	        }

	        if(!inSafe(this)){
	        	this.moveTo(cp.spawn)
	        }
    	}


    	callback(creep)
	})
}
function inSafe(pos){
	if(!hound.hits)
		return false
	return ep.soldiers.every(creep=>getRange(creep,hound)+5<getRange(creep,pos))
}

let hound
export function trySpawnHound(priority,callback){
	entrySpawn([MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,HEAL],priority,creep=>{

		creep.update = function(){

			let visual = new Visual(0,false)


			//移動速度計算
			const moveCount = this.body.filter(b=>b.type==MOVE&&0<b.hits).length
			const otherCount = this.body.filter(b=>b.type!=MOVE&&0<b.hits).length
			const moveTickSwamp = Math.ceil(otherCount/moveCount*5)
			const moveTickPlane = Math.ceil(otherCount/moveCount)
			const pathProp = {plainCost:moveTickPlane,swampCost:moveTickSwamp,costMatrix:matrixAttacker}

			//敵位置算出
			const nearEnemies = ep.soldiers.filter(creep=>getRange(creep,this)<10)
			let near = this.findClosestByRange(ep.soldiers)

			//ないなら敵スポーン
			if(near==null)
				near = ep.spawn

			//逃げるか引き撃ちか判定
			const fullHP = this.hitsMax<this.hits+50
			const inDanger = nearEnemies.some(creep=>getRange(this,creep)<creep.dangerRadius)
			const inSafe = nearEnemies.every(creep=>creep.dangerRadius<getRange(this,creep))

			if(inSafe&&fullHP){
				this.moveTo(near,pathProp)
				visual.line(this,near)
			}else if(inDanger||!fullHP){

				let rPoint = this.getEscapePos()
				//console.log("back point ",rPoint)

				let epath = findPath(this, rPoint,pathProp)
				let nextMove = epath[0]
				
				let prev = this
				for (var i = 0; i < epath.length&&i<5; i++) {
					visual.line(prev,epath[i],{color:'#0000F0',opacity:0.2})
					prev = epath[i]
				}
				
				this.moveTo(nextMove,pathProp)
				visual.line(this,rPoint,{color:'#0000F0',lineStyle:'dotted',opacity:0.2})
			}
			//console.log(matrixAttacker.get(this.x,this.y))
			
			this.heal(this)
			this.autoAttack(near)
	    }

 		creep.getEscapePos = calcEscapePos

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



//逃走経路算出creepをthisとする
let calcEscapePos = function(){
	 let visual = new Visual(0,false)
	//敵位置算出
	const nearEnemies = ep.soldiers.filter(creep=>getRange(creep,this)<10)
	let enemyPos = {x:this.x,y:this.y}
	nearEnemies.forEach(creep=>{
		const delta = {x:creep.x-this.x,y:creep.y-this.y}
		visual.circle(creep,{radius:0.4,opacity:0.2,fill:'#FF0000'})
		util.norm(delta)
		enemyPos.x += delta.x
		enemyPos.y += delta.y
	})

	//撤退する方向決定

	const ex = this.x - enemyPos.x
	const ey = this.y - enemyPos.y
	const border = {x:this.x-ey,y:this.y+ex}
	//敵が前にいるなら場所を変更
	if(nearEnemies.some(creep=>util.cross3(this,border,creep)<0))
		this.currentShield = null

	//次の遮蔽を検索
	if(this.currentShield==null){
		console.log("calc next shield")
		let minScore = 200
		let minId
		mp.bigIds.forEach(id=>{
			const pos = mp.id2Center[id]

			//危険度のスコア化
	    	//ベクトル化
			let vec = util.sub(this,pos)
			//90°回す
			util.rotate90(vec)
			//正規化
			util.norm(vec)

			//敵の数 180°10pt 120°20pt 
			let enemyScore = 0
			nearEnemies.forEach(creep=>{
				//ベクトル化して正規化して外積を取る
				const cross = util.cross(vec,util.norm(util.sub(creep,this)))
				if(0.5<cross){
					enemyScore += 20
				}else if(0<cross){
					enemyScore += 10
				}
			})
			//距離1 1pt
			const score = getRange(this,pos)+enemyScore			
			//console.log("enemyCount id",id,"score",total,"enemy",enemyScore,"range",getRange(this,pos))

			
			pos.y -= 1
			visual.circle(pos,{radius:0.2,opacity:0.4,fill:'#00F000'})
			visual.text(score,pos,{font:0.4})

			if(score<minScore){
				minScore = score
				minId = id
			}
		})
		this.currentShield = minId
	}


	//撤退位置の算出
	const backId = this.currentShield
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
        //次の位置の近くに敵がいるなら
        if(ep.soldiers.some(creep=>getRange(creep,rPoint)<3)){
        	this.currentShield = null
        	console.log("clear currentShield")
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
	return rPoint
}




