import {getTerrainAt,getObjectsByPrototype,getRange,getTicks,findClosestByRange} from '/game/utils';
import {} from '/game/prototypes';
import {TOP,TOP_RIGHT,RIGHT,BOTTOM_RIGHT,BOTTOM,BOTTOM_LEFT,LEFT,TOP_LEFT,TERRAIN_WALL,TERRAIN_SWAMP} from '/game/constants';
import { } from '/arena';
import {Visual} from '/game/visual';
import {CostMatrix,searchPath} from '/game/path-finder';

import * as util from './utils';
import * as pf from './profiler';
import * as cp from './creeps';

class MapData{
    constructor(func){
        this.filter = func

        this.idMap
        //構成するすべてのPosを格納してある
        this.id2AllPos = []
    }    

    //idMap + id2AllPos
    makeIdMap(func){
        //let visual = new Visual(0,false)

        this.idMap = new CostMatrix()
        this.id2AllPos = []
        let minEmpty = 0
        //障害物ラベル化
        for(let y = 0; y < 100; y++) {
            for(let x = 0; x < 100; x++) {
                const pos = {x:x,y:y}
                //カスタム関数がないならデフォで
                if((func!=null&&!func(pos))||(func==null&&!this.filter(pos)))
                    continue
                
                const left = this.idMap.get(x-1,y)
                const up = this.idMap.get(x,y-1)

                if(up!=null&&up!=0){
                    //上を確認
                    this.idMap.set(x,y,up)
                    this.id2AllPos[up].push(pos)
                    //間違えてる分を修正
                    if(left!=null&&left!=0&&up!=left){
                        //左上を優先
                        let from
                        let to

                        const pLeft = this.id2AllPos[left][0]
                        const pUp = this.id2AllPos[up][0]
                        if(pLeft.y<pUp.y||pLeft.y==pUp.y&&pLeft.x<pUp.x){
                            from = up
                            to = left
                        }else{
                            from = left
                            to = up
                        }

                        for(const change of this.id2AllPos[from]){
                            this.idMap.set(change.x,change.y,to)
                        }
                        this.id2AllPos[to] = this.id2AllPos[to].concat(this.id2AllPos[from])
                        this.id2AllPos[from] = null
                        minEmpty = Math.min(minEmpty,from)
                        //visual.text(from,pos,{font:0.4,color:'#F00000'})
                    }
                }else if(left!=null&&left!=0){
                    //左を確認
                    this.idMap.set(x,y,left)
                    this.id2AllPos[left].push(pos)
                }else{
                    //最小の空いてるインデックスを探す
                    let index
                    for(index = minEmpty; this.id2AllPos[index]!=null; index++){
                    }
                    minEmpty = index + 1

                    this.idMap.set(x,y,index)
                    this.id2AllPos[index]=[pos]

                    //visual.text(index,pos,{font:0.4,color:'#00F000'})
                    //visual.circle(pos,{radius:0.3,opacity:0.4,fill:'#F0F0F0'})
                    
                }
            }
        }
    }
}

class WallData extends MapData{
    constructor(){
        super(pos=>getTerrainAt(pos)==TERRAIN_WALL)

        this.id2Convex = []
        //辺までの反時計回りの外周長さ
        this.id2ConvexLength = []
        //凸型の外周の長さ
        this.id2ConvexTotalLength = []
        this.id2Center = []

        this.bigIds = []
        this.Id4RangedAttack = []
        this.Id4Attack = []
        this.allIds = []
        this.visual = new Visual(0,true)

    }

    update(){
        const visual = this.visual
        visual.clear()
        this.makeIdMap()

        //外周以外
        for(let id = 2; id < this.id2AllPos.length; id++) {
             
            //空なら戻る
            if(this.id2AllPos[id]==null)
                continue

            const length = this.id2AllPos[id].length

            //重心算出
            const center = {x:0,y:0}
            this.id2AllPos[id].forEach(p=>{
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
            this.id2Center[id] = center
            visual.text(id,center,{font:0.4})

            //IDリスト登録
            if(20<length&&length<200&&center.x<85&&14<center.x)
                this.bigIds.push(id)
            this.allIds.push(id)

            const outline = calcOutline(id,this.id2AllPos[id][0],this.idMap)

            const convex = calcConvex(outline)

            this.id2Convex[id] = convex            

            //凸型計算
            let convexLength = []
            let total = 0
            convex.forEach((p0,i)=>{
                const p1 = convex[(convex.length + i + 1) % convex.length]

                convexLength[i] = total
                total += getRange(p0,p1)
            })
            
            this.id2ConvexLength[id] = convexLength
            this.id2ConvexTotalLength[id] = total

            if(length<20)
                visual.poly(convex.concat(convex[0]),{opacity:0.4,stroke:'#0000F0'})
            else
                visual.poly(convex.concat(convex[0]),{opacity:0.4,stroke:'#F00000'})
            
        }
    }

    //== API ==

    //凸型上の実座標を返す
    getPointConvex(id,pos){
        return calcPointPoly(pos,this.id2Convex[id],this.id2ConvexLength[id],this.id2ConvexTotalLength[id])
    }

    //凸型との接点
    getTangentConvex(id,point){
        return calcTangentPoly(point,this.id2Convex[id])
    }

    //凸型との最短距離算出
    //dist 距離 移動距離じゃないので注意
    //point 最短位置
    //pos 0-1クリップの凸型内の位置 
    getRangeConvex(id,point){
        return calcRangePoly(point,this.id2Convex[id],this.id2ConvexLength[id],this.id2ConvexTotalLength[id])
    }
}

//内周を反時計回りに1周する点の配列を返す
function calcInline(id,start,map){
    //外周探索
    //初めの座標 の1上
    let orgPos = start
         
    let pos = orgPos
    const outline = [orgPos]
    let lastDir = LEFT

    out_loop:
    while(true) {
        in_loop:
        for(let i = 10; 2 < i; i-=2) {
            let tmp = util.move(pos,lastDir+i)
            if(map.get(tmp.x,tmp.y)==id){

                //末端なら
                if(tmp.x==orgPos.x&&tmp.y==orgPos.y){
                    break out_loop
                }

                outline.push(tmp)
                        
                pos = tmp
                lastDir += i
                continue out_loop
            }
        }
        break out_loop
    }
    return outline
}

class SwampData extends MapData{
    constructor(){
        super(pos=>getTerrainAt(pos)==TERRAIN_SWAMP)

        this.id2Convex = []
        //辺までの反時計回りの外周長さ
        this.id2ConvexLength = []
        //凸型の外周の長さ
        this.id2ConvexTotalLength = []
        this.id2Center = []

        this.id2Edge = []

        this.bigIds = []
        this.allIds = []
        this.visual = new Visual(0,true)
    }

    update(){
        const visual = this.visual
        visual.clear()

        this.makeIdMap()

        //1マス内側に
        const map = this.idMap

        for(let id = 1; id < this.id2AllPos.length; id++) {
            //空なら戻る
            if(this.id2AllPos[id]==null)
                continue

            const inline = calcInline(id,this.id2AllPos[id][0],this.idMap)

            inline.forEach(pos=>{
                if(!util.all3x3(pos,(p)=>getTerrainAt(p)!=0))
                    map.set(pos.x,pos.y,0)
            })
        }
        this.makeIdMap(pos=>map.get(pos.x,pos.y)!=0)

        
        //外周以外
        for(let id = 1; id < this.id2AllPos.length; id++) {
             
            //空なら戻る
            if(this.id2AllPos[id]==null)
                continue

            const length = this.id2AllPos[id].length

            //重心算出
            const center = {x:0,y:0}
            this.id2AllPos[id].forEach(p=>{
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
            this.id2Center[id] = center
            visual.text(id,center,{font:0.4})

            //IDリスト登録
            if(20<length&&length<200&&center.x<85&&14<center.x)
                this.bigIds.push(id)
            this.allIds.push(id)

            const outline = calcInline(id,this.id2AllPos[id][0],this.idMap)
            this.id2Edge[id] = outline
            visual.poly(outline.concat(outline[0]),{opacity:0.4,stroke:'#0000F0'})
        }
    }

    //== API ==

    //凸型上の実座標を返す
    getPointConvex(id,pos){
        return calcPointPoly(pos,this.id2Convex[id],this.id2ConvexLength[id],this.id2ConvexTotalLength[id])
    }

    //凸型との接点
    getTangentConvex(id,point){
        return calcTangentPoly(point,this.id2Convex[id])
    }

    //凸型との最短距離算出
    //dist 距離 移動距離じゃないので注意
    //point 最短位置
    //pos 0-1クリップの凸型内の位置 
    getRangeConvex(id,point){
        return calcRangePoly(point,this.id2Convex[id],this.id2ConvexLength[id],this.id2ConvexTotalLength[id])
    }
}


export let wallInfo = new WallData()
export let swampInfo = new SwampData()

let isInit = false

export function update(){
    if(isInit)
        return
    isInit = true

    wallInfo.update()
    swampInfo.update()
}


function calcConvex(outline){
    //凸型抽出
    const orgPos = outline[0]
    outline.sort((a,b)=>compare(orgPos,a,b))
    const convex = [orgPos]
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
    //convex.pop()
    return convex
}

//外周の反時計回りに1周する点の配列を返す
function calcOutline(id,start,map){
    //外周探索
    //初めの座標 の1上
    let orgPos = util.move(start,TOP)
         
    let pos = orgPos
    const outline = [orgPos]
    let lastDir = LEFT

    out_loop:
    while(true) {

        in_loop:
        for(let i = 6; i < 14; i++) {
            let tmp = util.move(pos,lastDir+i)
            if(map.get(tmp.x,tmp.y)!=id){
                //末端なら
                if(tmp.x==orgPos.x&&tmp.y==orgPos.y){
                    break out_loop
                }

                outline.push(tmp)
                        
                pos = tmp
                lastDir += i
                break in_loop
            }
        }
    }
    return outline
}

//凸型上の実座標を返す
function calcPointPoly(pos,poly,range,totalRange){
    let visual = new Visual(0,false)
    const position = (pos%1)*totalRange
    //頂点を走査
    let location
    let flag = true
    poly.forEach((p0,i0)=>{
        const i1 = (poly.length + i0 + 1) % poly.length
        const p1 = poly[i1]

        //次頂点のPosより大きいなら次
        if(flag&&(range[i1]==0||position<range[i1])){
            const f = (position - range[i0]) / (range[i1] - range[i0])
            const x = p0.x + (p1.x - p0.x) * f
            const y = p0.y + (p1.y - p0.y) * f
            location = {x:x,y:y}
            //console.log("point ",location,p0,p1,f)
            flag = false
        }
    })
    return location
}

//凸型との接点
function calcTangentPoly(point,poly){
    let visual = new Visual(0,false)
    const res = []
    //辺を走査
    let prev = util.cross3(poly[poly.length-1],point,poly[0])
    poly.forEach((p0,i)=>{
        const p1 = poly[(poly.length + i + 1) % poly.length]
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
function calcRangePoly(point,poly,range,totalRange){
    let minDist = 40000
    let minPoint
    let minPos
    //辺を走査
    poly.forEach((p0,i)=>{
        const p1 = poly[(poly.length + i + 1) % poly.length]
        const pos = range[i]
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
    return {dist:Math.sqrt(minDist),point:minPoint,pos:minPos/totalRange}
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