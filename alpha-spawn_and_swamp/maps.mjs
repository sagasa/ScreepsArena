import {getTerrainAt,getObjectsByPrototype,getRange,getTicks,findClosestByRange} from '/game/utils';
import {} from '/game/prototypes';
import {TOP,TOP_RIGHT,RIGHT,BOTTOM_RIGHT,BOTTOM,BOTTOM_LEFT,LEFT,TOP_LEFT,TERRAIN_WALL} from '/game/constants';
import { } from '/arena';
import {Visual} from '/game/visual';
import {CostMatrix,searchPath} from '/game/path-finder';

import * as util from './utils';

import * as cp from './creeps';

let wallIdMap
let id2Wall = []
let id2Convex = []
//辺までの反時計回りの外周長さ
let id2ConvexLength = []
//凸型の外周の長さ
let id2ConvexTotalLength = []

export let id2Center = []

export let bigIds = []
export let allIds = []


//色分け
class MapData{
    
}

export function update(){

    bigIds = []
    allIds = []


	let visual = new Visual(0,false)

    let map = new CostMatrix()
    let minEmpty = 0
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
       				//visual.text(from,pos,{font:0.4,color:'#F00000'})
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
       			//visual.circle(pos,{radius:0.3,opacity:0.4,fill:'#F0F0F0'})
       			
       		}
        }
    }
    wallIdMap = map
    id2Wall = posArray



    //外周以外
    for(let id = 2; id < posArray.length; id++) {
        //空なら戻る
    	if(posArray[id]==null)
    		continue

        const length = posArray[id].length

        //重心算出
        const center = {x:0,y:0}
        posArray[id].forEach(p=>{
            center.x += p.x
            center.y += p.y
        })
        center.x /= length
        center.y /= length
        //左右の大きい障害物ならxを修正
        if(200<length){
            if(center.x<50)
                center.x = 14
            else
                center.x = 85
        }
        id2Center[id] = center
        visual.text(id,center,{font:0.4})

        //IDリスト登録
        if(20<length&&length<200&&center.x<85&&14<center.x)
            bigIds.push(id)
        allIds.push(id)


        //外周探索
    	//初めの座標
    	let orgPos = posArray[id][0]
    	//の1上
    	orgPos.y -= 1

        let pos = orgPos
        const outline = []
        let lastDir = LEFT

        out_loop:
        while(true) {

            in_loop:
            for(let i = 6; i < 14; i++) {
                let tmp = util.move(pos,lastDir+i)
                if(getTerrainAt(tmp)!=TERRAIN_WALL){
                    outline.push(tmp)
                    
                    pos = tmp
                    lastDir += i
                    break in_loop
                }
            }
            if(pos.x==orgPos.x&&pos.y==orgPos.y){
                break out_loop
            }
        }

        //凸型抽出
        outline.sort((a,b)=>compare(orgPos,a,b))
        const convex = []
        //convex.push(orgPos)
        outline.forEach((p,i)=>{
            while(1<convex.length&&util.cross3(convex[convex.length-1],convex[convex.length-2],p) <= 0){
                const cross = util.cross3(convex[convex.length-1],convex[convex.length-2],p)
                
                //console.log("cross ",convex[convex.length-1],convex[convex.length-2],p," = ",cross)
                const pop = convex.pop()
                //visual.text(cross,pop,{font:0.4})
                //visual.circle(pop,{radius:0.2,opacity:0.4,fill:'#F00000'})
            }
            convex.push(p)
                
        })
        convex.pop()
        convex.push(orgPos)
        id2Convex[id] = convex

        //凸型計算
        let convexLength = []
        let total = 0
        convex.forEach((p0,i)=>{
            const p1 = convex[(convex.length + i + 1) % convex.length]

            convexLength[i] = total

            visual.line(p0,p1)
            visual.text(total,p0,{font:0.4})
             //小さいなら戻る
            if(length<20)
                visual.circle(p0,{radius:0.2,opacity:0.4,fill:'#0000F0'})
            else
                visual.circle(p0,{radius:0.2,opacity:0.4,fill:'#F00000'})

            total += getRange(p0,p1)
        })
        
        id2ConvexLength[id] = convexLength
        id2ConvexTotalLength[id] = total

        //テスト表示
        if(0<cp.myCreeps.length&&false){
            
            const target = cp.myCreeps[cp.myCreeps.length-1]

            visual.circle(target,{radius:0.3,opacity:0.2,fill:'#00F000'})
            const res = getRangeConvex(id,target)

            visual.circle(res.point,{radius:0.3,opacity:0.2,fill:'#F000F0'})
            visual.text(res.dist,res.point,{font:0.4})
        }
    }
}

//凸型上の実座標を返す
export function getPointConvex(id,pos){
    let visual = new Visual(0,false)

    const position = (pos%1)*id2ConvexTotalLength[id]
    const convexLength = id2ConvexLength[id]
    const convex = id2Convex[id]
    //頂点を走査
    let location
    let flag = true
    convex.forEach((p0,i0)=>{
        const i1 = (convex.length + i0 + 1) % convex.length
        const p1 = convex[i1]

        //次頂点のPosより大きいなら次
        if(flag&&(convexLength[i1]==0||position<convexLength[i1])){
            const f = (position - convexLength[i0]) / (convexLength[i1] - convexLength[i0])
            const x = p0.x + (p1.x - p0.x) * f
            const y = p0.y + (p1.y - p0.y) * f
            location = {x:x,y:y}
            console.log("point ",location,p0,p1,f)
            flag = false
        }
    })
    return location
}

//凸型との接点
export function getTangentConvex(id,point){
    let visual = new Visual(0,false)
    const res = []
    const convex = id2Convex[id]
    //辺を走査
    let prev = util.cross3(convex[convex.length-1],point,convex[0])
    convex.forEach((p0,i)=>{
        const p1 = convex[(convex.length + i + 1) % convex.length]
        const current = util.cross3(p0,point,p1)
        if(current==0){
            const pos = {x:(p0.x+p1.x)/2,y:(p0.y+p1.y)/2}
            res.push(pos)
            //visual.circle(pos,{radius:0.4,opacity:0.2,fill:'#0000F0'})
        }else if(prev!=0&&current<0!=prev<0){
            //console.log("tangent near")  
            res.push(p0) 
            //visual.circle(p0,{radius:0.4,opacity:0.2,fill:'#0000F0'}) 
        }
        prev = current
    })
    return res
}

//凸型との最短距離算出
//dist 距離 移動距離じゃないので注意
//point 最短位置
//pos 0-1クリップの凸型内の位置 
export function getRangeConvex(id,point){
    let minDist = 40000
    let minPoint
    let minPos
    const convex = id2Convex[id]
    //辺を走査
    convex.forEach((p0,i)=>{
        const p1 = convex[(convex.length + i + 1) % convex.length]
        const pos = id2ConvexLength[id][i]
        //頂点との距離
        {
            const dist = getRangeLight(p0,point)
            if(dist<minDist){
                minPoint = p0
                minDist = dist
                minPos = pos
            }
        }
        //辺との距離
        if(isInline(p0,p1,point)){
            //点の垂線算出
            const v0 = {x:p1.x-p0.x,y:p1.y-p0.y}
            const v1 = {x:point.x-p0.x,y:point.y-p0.y}
            util.norm(v0)
            const l = util.dot(v0,v1)
            v0.x *= l
            v0.y *= l
            v0.x += p0.x
            v0.y += p0.y
            const dist = getRangeLight(v0,point)
            if(dist<minDist){
                minPoint = v0
                minDist = dist
                minPos = pos + getRange(p0,v0)
            }
        }
    })
    return {dist:Math.sqrt(minDist),point:minPoint,pos:minPos/id2ConvexTotalLength[id]}
}

function compare(m, a, b){
    return (a.x-m.x)/(a.y-m.y) - (b.x-m.x)/(b.y-m.y)
}

//sqrtかけないRange
function getRangeLight(a,b){
    const x = a.x - b.x,y = a.y - b.y
    return x*x+y*y
}

//いい関数名が思いつかなかった
function isInline(a, b, c){
    return 0 < util.dot3(a,b,c) && 0 < util.dot3(b,a,c)
}