import { getObjectsByPrototype,getRange,findClosestByRange,createConstructionSite,findPath,getDirection,getTerrainAt,findInRange} from '/game/utils';
import { Creep, StructureSpawn ,StructureContainer,ConstructionSite,StructureTower,StructureRampart} from '/game/prototypes';
import {MOVE,ERR_NOT_ENOUGH_ENERGY ,RESOURCE_ENERGY,ERR_NOT_IN_RANGE,CARRY,ATTACK,RANGED_ATTACK,HEAL,WORK,TERRAIN_WALL,TERRAIN_SWAMP} from '/game/constants';
import {TOP,TOP_RIGHT,RIGHT,BOTTOM_RIGHT,BOTTOM,BOTTOM_LEFT,LEFT,TOP_LEFT} from '/game/constants';
import { } from '/arena';
import {CostMatrix,searchPath} from '/game/path-finder';

export function getMin(array,func){
	let min = null
	array.forEach(e=>{
		if(min==null||func(e,min)<0)
			min = e
	})
    return min
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