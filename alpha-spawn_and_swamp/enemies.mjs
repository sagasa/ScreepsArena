import {getTerrainAt } from '/game/utils';
import {Creep,StructureSpawn,StructureRoad} from '/game/prototypes';
import {ATTACK,RANGED_ATTACK,HEAL,WORK,CARRY,MOVE,TERRAIN_WALL} from '/game/constants';
import { } from '/arena';
import {Visual} from '/game/visual';
import {CostMatrix,searchPath} from '/game/path-finder';
import { getObjectsByPrototype,getRange,getTicks } from '/game/utils';

class creep_profiler{

	constructor(creep){
		//移動計測用
		this.lastPos={x:creep.x,y:creep.y}
		this.lastMoveTick

		this.weight
	}
	update(creep){
		if(creep.x!=this.lastPos.x||creep.y!=this.lastPos.y){
			this.lastMoveTick = getTicks()
			//console.log('move',this.lastMoveTick)
		}

		//機動力計測
		let moveCount = creep.body.filter(b=>b.type==MOVE&&0<b.hits).length
		let otherCount = creep.body.filter(b=>b.type!=MOVE&&b.type!=CARRY&&0<b.hits).length

		creep.moveTickSwamp = Math.ceil(otherCount/moveCount*5)
		creep.moveTickPlane = Math.ceil(otherCount/moveCount)
		creep.canMove = creep.fatigue <= 0 && 0 < moveCount

		//攻撃性計測
		
		if(creep.body.some(b=>b.type==RANGED_ATTACK&&0<b.hits)){
			//遠距離持ち
			creep.dangerRadius = 4
		}else if(creep.body.some(b=>b.type==ATTACK&&0<b.hits)){
			//近接持ち
			creep.dangerRadius = 3
		}
		
		

		//console.log("move tick",this.moveTickSwamp,this.moveTickPlane,this.canMove)

		this.lastPos = {x:creep.x,y:creep.y}
	}
}

export let spawn
export let creeps=[]
export let attackers=[]
export let rangedAttackers=[]
export let healers=[]
export let workers=[]
export let transporters=[]
export let soldiers=[]

export let map = new CostMatrix()

let isInit,sideLeft

export let centerArea,enemySpawnArea,mySpawnArea

function rect(x,y,w,h){
	const rect = {x:x,y:y,w:w,h:h}
	rect.contain = function(pos){

	}
	return rect
}

function init(){
	spawn = getObjectsByPrototype(StructureSpawn).find(spawn=>!spawn.my)
	sideLeft = spawn.x<50

	centerArea = rect(14,0,71,99)
	if(sideLeft){
		enemySpawnArea = rect(0,19,13,61)
		mySpawnArea = rect(86,19,13,61)
	}else{
		mySpawnArea = rect(0,19,13,61)
		enemySpawnArea = rect(86,19,13,61)
	}
	
}

export function update(){
	if(!isInit){
        init();
        isInit=true;
    }
	
	creeps = getObjectsByPrototype(Creep).filter(creep=>!creep.my&&creep.hits!=null)
	creeps.forEach(creep=>{
		if(!creep.profiler)
			creep.profiler = new creep_profiler(creep)
		creep.profiler.update(creep)
	})

    attackers = creeps.filter(creep=>creep.body.some(b=>b.type==ATTACK))
    rangedAttackers = creeps.filter(creep=>creep.body.some(b=>b.type==RANGED_ATTACK))
    healers = creeps.filter(creep=>creep.body.some(b=>b.type==HEAL))

    soldiers = creeps.filter(creep=>creep.body.some(b=>b.type==RANGED_ATTACK||b.type==HEAL||b.type==ATTACK))
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
    	if(creep.profiler.canMove){
    		paint(creep,3,1,15)

    	}else{
    		paint(creep,3,0,15)
    	}
    	//visual.text(map.get(creep.x,creep.y),creep,{font:0.3})
    })

    attackers.forEach(creep=>{
    	if(creep.profiler.canMove){
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