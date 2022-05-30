import { prototypes, utils } from '/game';

import { getObjectsByPrototype,getRange,findClosestByRange,createConstructionSite,findPath,getDirection,getTerrainAt,findInRange} from '/game/utils';
import { Creep, StructureSpawn ,StructureContainer,ConstructionSite,StructureTower,StructureRampart} from '/game/prototypes';
import {MOVE,ERR_NOT_ENOUGH_ENERGY ,RESOURCE_ENERGY,ERR_NOT_IN_RANGE,CARRY,ATTACK,RANGED_ATTACK,HEAL,WORK,TERRAIN_WALL,TERRAIN_SWAMP} from '/game/constants';
import {TOP,TOP_RIGHT,RIGHT,BOTTOM_RIGHT,BOTTOM,BOTTOM_LEFT,LEFT,TOP_LEFT} from '/game/constants';
import { } from '/arena';
import {CostMatrix,searchPath} from '/game/path-finder';

//建築物と
const matrixCommon = new CostMatrix

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

let spawnHolder,spawnEntries = []

export function entrySpawn(body,priority,callback){
    spawnEntries.push({body:body,priority:priority,callback:callback})
}

export function trySpawn(){
    if(spawnEntries.length==0)return
    if(!spawnHolder)
        spawnHolder = new spawn_holder(getObjectsByPrototype(StructureSpawn).find(spawn=>spawn.my))

    spawnEntries.sort((a,b)=>b.priority-a.priority)

    const priority = spawnEntries[0].priority
    for(const entry of spawnEntries){
        if(entry.priority<priority)
            break
        const creep = spawnHolder.trySpawn(entry.body)
        if(creep!=null){
            entry.callback(creep)
            break
        }
    }
    spawnEntries = []
}

//数値化できる場合向け
export function getMin1(array,func){
    if(array.length==1)
        return array[0]
    let min = null
    let minValue = 0
    array.forEach(e=>{
        const ev = func(e)
        if(min==null||ev<minValue){
            min = e
            minValue = ev
        }
    })
    return min
}

export function getMin(array,func){
    if(array.length==1)
        return array[0]
	let min = null
	array.forEach(e=>{
		if(min==null||func(e,min)<0)
			min = e
	})
    return min
}

export function getMinIndex(array,func){
    if(array.length==1)
        return 0
    let min = null
    let index = -1
    array.forEach((e,i)=>{
        if(min==null||func(e,min)<0){
            min = e
            index = i
        }
    })
    return index
}

export function all3x3(pos,func){
    for (var x = pos.x-1; x <= pos.x+1; x++) {
        for (var y = pos.y-1; y <= pos.y+1; y++) {
            if((pos.x!=x||pos.y!=y)&&!func({x:x,y:y}))
                return false
        }
    }
    return true
}

export function canMove(pos){
    return getTerrainAt({x: pos.x, y: pos.y})!=1
}

export function check3x3(pos,func=null){
    let allMove = [TOP_RIGHT,BOTTOM_RIGHT,BOTTOM_LEFT,TOP_LEFT,TOP,RIGHT,BOTTOM,LEFT]
    if((func==null||!func())||!canMove({x: pos.x-1, y: pos.y-1})){
        allMove = allMove.filter(m=>m!=TOP_LEFT&&m!=LEFT&&m!=TOP)
    }
    if((func==null||!func())||!canMove({x: pos.x, y: pos.y-1})){
        allMove = allMove.filter(m=>m!=TOP_LEFT&&m!=TOP_RIGHT&&m!=TOP)
    }
    if((func==null||!func())||!canMove({x: pos.x+1, y: pos.y-1})){
        allMove = allMove.filter(m=>m!=RIGHT&&m!=TOP_RIGHT&&m!=TOP)
    }
    if((func==null||!func())||!canMove({x: pos.x-1, y: pos.y})){
        allMove = allMove.filter(m=>m!=LEFT&&m!=TOP_LEFT&&m!=BOTTOM_LEFT)
    }
    if((func==null||!func())||!canMove({x: pos.x+1, y: pos.y})){
        allMove = allMove.filter(m=>m!=RIGHT&&m!=TOP_RIGHT&&m!=BOTTOM_RIGHT)
    }
    if((func==null||!func())||!canMove({x: pos.x-1, y: pos.y+1})){
        allMove = allMove.filter(m=>m!=LEFT&&m!=BOTTOM&&m!=BOTTOM_LEFT)
    }
    if((func==null||!func())||!canMove({x: pos.x, y: pos.y+1})){
        allMove = allMove.filter(m=>m!=BOTTOM_RIGHT&&m!=BOTTOM&&m!=BOTTOM_LEFT)
    }
    if((func==null||!func())||!canMove({x: pos.x+1, y: pos.y+1})){
        allMove = allMove.filter(m=>m!=RIGHT&&m!=BOTTOM&&m!=BOTTOM_RIGHT)
    }
    return allMove
}

export function move(pos,direction){
    const dir = (direction+7)%8 + 1
    if(dir==TOP_LEFT)
        return {x:pos.x-1,y:pos.y-1}
    if(dir==TOP)
        return {x:pos.x,y:pos.y-1}
    if(dir==TOP_RIGHT)
        return {x:pos.x+1,y:pos.y-1}
    if(dir==LEFT)
        return {x:pos.x-1,y:pos.y}
    if(dir==RIGHT)
        return {x:pos.x+1,y:pos.y}
    if(dir==BOTTOM_LEFT)
        return {x:pos.x-1,y:pos.y+1}
    if(dir==BOTTOM)
        return {x:pos.x,y:pos.y+1}
    if(dir==BOTTOM_RIGHT)
        return {x:pos.x+1,y:pos.y+1}
    console.log("not move ",dir)
    return pos
}

export function getDirection4(x,y){
    if(Math.abs(x)<Math.abs(y))
        if(y<0)
            return TOP
        else
            return BOTTOM
    else
        if(x<0)
            return LEFT
        else
            return RIGHT
}

export function clamp1(val){
    return Math.max(-1,Math.min(1,val))
}

export function dot3(a, b, c){
    const ax = a.x-b.x
    const bx = c.x-b.x
    const ay = a.y-b.y
    const by = c.y-b.y
    return ax*bx + ay*by
}

export function dot(a, b){
    return a.x*b.x + a.y*b.y
}

export function cross3(a, b, c){
    return (b.x-a.x)*(c.y-a.y) - (b.y-a.y)*(c.x-a.x)
}

export function cross(a, b){
    return (a.x)*(b.y) - (a.y)*(b.x)
}

//dest無しならvを改変
export function norm(v,dest){
    const l = Math.sqrt(v.x*v.x+v.y*v.y)
    if(dest==null){
        v.x /= l
        v.y /= l
        return v
    }
    dest = v.x/l
    dest = v.y/l
    return dest
}

//90°回す
export function rotate90(vec,dest){
    const x = vec.x
    const y = vec.y
    if(dest==null){
        vec.x = -y
        vec.y = x
        return vec
    }
    
    dest.x = -y
    dest.y = x
    return dest
}

export function sum(v0,v1,dest){
    if(dest==null)
        return {x:v0.x+v1.x,y:v0.y+v1.y}
    dest.x = v0.x+v1.x
    dest.y = v0.y+v1.y
    return dest
}

export function sub(v0,v1,dest){
    if(dest==null)
        return {x:v0.x-v1.x,y:v0.y-v1.y}
    dest.x = v0.x-v1.x
    dest.y = v0.y-v1.y
    return dest
}

export function tryCreateConstructionSite(pos,type,callback){
    const res = utils.createConstructionSite(pos,type)
    if(res.error)
        console.log(`err in createConstructionSite at:[${pos.x},${pos.y}], type:${type.name} ,state:${getErrMsg(res.error)}`)
    else if(callback!=null){
        callback(res.object)
    }
    return res.object
}

//エラーコードが0以外ならログを出してfalseを返す
export function tryJob(error,name,debug = true){
    
    if(error!=0){
        if(name!=null)
            if(debug)console.log(`err in ${name} state:${getErrMsg(error)}`)
        else
            if(debug)console.log(`err in job state:${getErrMsg(error)}`)
        return false
    }
    return true
}

export function isDone(construction){
    return construction.id != null&&!construction.progressTotal
}

export function getErrMsg(err){
    switch (err) {
        case 0:
            return 'OK'
        case -1:
            return 'ERR_NOT_OWNER'
        case -2:
            return 'ERR_NO_PATH'
        case -3:
            return 'ERR_NAME_EXISTS'
        case -4:
            return 'ERR_BUSY'
        case -5:
            return 'ERR_NOT_FOUND'
        case -6:
            return 'ERR_NOT_ENOUGH_SOMEONE'
        case -7:
            return 'ERR_INVALID_TARGET'
        case -8:
            return 'ERR_FULL'
        case -9:
            return 'ERR_NOT_IN_RANGE'
        case -10:
            return 'ERR_INVALID_ARGS'
        case -11:
            return 'ERR_TIRED'
        case -12:
            return 'ERR_NO_BODYPART'
        default:
            console.log(`Unexpected error code ${err}`)
            return '???'
    }
}