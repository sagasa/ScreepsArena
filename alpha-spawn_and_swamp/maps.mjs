import {getTerrainAt,getObjectsByPrototype,getRange,getTicks} from '/game/utils';
import {} from '/game/prototypes';
import {TOP,TOP_RIGHT,RIGHT,BOTTOM_RIGHT,BOTTOM,BOTTOM_LEFT,LEFT,TOP_LEFT,TERRAIN_WALL} from '/game/constants';
import { } from '/arena';
import {Visual} from '/game/visual';
import {CostMatrix,searchPath} from '/game/path-finder';

import {move} from './utils';

export function update(){


	let visual = new Visual(0,false)

    let map = new CostMatrix()
    let minEmpty = 1
    let posArray = []
    //障害物ラベル化
    for(let y = 0; y < 100; y++) {
        for(let x = 0; x < 100; x++) {
        	const pos = {x:x,y:y}
        	if(getTerrainAt(pos)!=TERRAIN_WALL)
        		continue
        	
        	const left = map.get(x-1,y)
        	const up = map.get(x,y-1)

        	if(up!=null&&up!=0){
       			//上を確認
       			map.set(x,y,up)
       			posArray[up].push(pos)
       			//間違えてる分を修正
       			if(left!=null&&left!=0&&up!=left){
       				//IDが小さいほうを優先
       				let from = Math.max(left,up)
       				let to = Math.min(left,up)

       				for(const change of posArray[from]){
       					map.set(change.x,change.y,to)
       				}
       				posArray[to] = posArray[to].concat(posArray[from])
       				posArray[from] = null
       				minEmpty = Math.min(minEmpty,from)
       				visual.text(from,pos,{font:0.4,color:'#F00000'})
       			}
       		}else if(left!=null&&left!=0){
       			//左を確認
       			map.set(x,y,left)
       			posArray[left].push(pos)
       		}else{
       			//最小の空いてるインデックスを探す
       			let index
       			for(index = minEmpty; posArray[index]!=null; index++){
       			}
       			minEmpty = index + 1

       			map.set(x,y,index)
       			posArray[index]=[pos]
       			visual.circle(pos,{radius:0.3,opacity:0.4,fill:'#F0F0F0'})
       			visual.text(index,pos,{font:0.4})
       		}
        }
    }

    //外周以外
    for(let id = 2; id < posArray.length; id++) {
    	if(posArray[id]==null)
    		continue
    	//初めの座標
    	let pos = posArray[id][0]
    	//の1上
    	pos.y -= 1

    	//外周探索
    	visual.circle(pos,{radius:0.3,opacity:0.4,fill:'#0000F0'})

    	let lastDir = BOTTOM_LEFT
    	
    	let tmp = move(pos,lastDir)
    	if(getTerrainAt(tmp)!=TERRAIN_WALL){
    		visual.circle(pos,{radius:0.3,opacity:0.4,fill:'#0000F0'})
    	}
    	
    }
}

