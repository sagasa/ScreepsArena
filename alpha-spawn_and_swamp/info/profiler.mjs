import {arenaInfo} from 'game';
import {getCpuTime,getTicks} from 'game/utils';
import {Visual} from '/game/visual';

import * as util from '../utils';

/*
== 使い方 ==
loopの最初にstartを,最後にendを呼ぶ

lap("name","#color")でラップを

const sec = section("name","#color")でセクションを開始
sec.end()で終了
===========
*/


//グラフの原点
const GraphOrigin = {x:103,y:25}

const back = new Visual(0,true)
const info = new Visual(0,true)
const graph = new Visual(0,true)

let tickOffset = 0
let lastLap

let lapTable = {}
let lapSize = 0

export function lap(name,color) {
    const x = (getTicks() - tickOffset) / 2
    const lastCpuMs = lastLap / 1000000.0
    const currentCpuMs = getCpuTime() / 1000000.0
    const deltaCpuMs = currentCpuMs - lastCpuMs
    util.sum(GraphOrigin,{x:x,y:-currentCpuMs/2})
    graph.rect(util.sum(GraphOrigin,{x:x-0.45,y:-lastCpuMs/2}),0.4,-deltaCpuMs/2,{fill:color,opacity:0.8})
    //graph.line(util.sum(GraphOrigin,{x:x,y:-lastCpuMs/2}),util.sum(GraphOrigin,{x:x,y:-currentCpuMs/2}))

    //console.log("lap",name,deltaCpuMs,"ms")

    //今までに無いキーなら
    if(lapTable[name]==null){
        back.rect(util.sum(GraphOrigin,{x:lapSize * 5 + 6,y:2}),1,1,{fill:color,opacity:0.8})
        back.text(name,util.sum(GraphOrigin,{x:lapSize * 5 + 6.5,y:3.5}),{font:0.6,color:'#A0A0F0'})
        lapTable[name] = color
        lapSize++
    }
    
    lastLap = getCpuTime()
}

let sectionTable = {}
let sectionSize = 0

export function section(name,color) {
    //今までに無いキーなら
    if(sectionTable[name]==null){
        back.rect(util.sum(GraphOrigin,{x:sectionSize * 5 + 6,y:4}),1,1,{fill:color,opacity:0.8})
        back.text(name,util.sum(GraphOrigin,{x:sectionSize * 5 + 6.5,y:5.5}),{font:0.6,color:'#A0A0F0'})
        sectionTable[name] = {color:color,time:0}
        sectionSize++
    }
    const res = {name:name,color:color,start:getCpuTime()}
    res.end = function(){
        //終了用処理
        const deltaCpuMs = (getCpuTime() - this.start) / 1000000.0
        sectionTable[this.name].time += deltaCpuMs
    }
    return res
}



let isInit
function init(){
    back.line(GraphOrigin,util.sum(GraphOrigin,{x:50,y:0}),{width:0.05,opacity:1})
    back.line(GraphOrigin,util.sum(GraphOrigin,{x:0,y:-27}),{width:0.05,opacity:1})

    back.line(util.sum(GraphOrigin,{x:0,y:1.8}),util.sum(GraphOrigin,{x:50,y:1.8}),{width:0.05,opacity:0.6})
    back.text('Lap',util.sum(GraphOrigin,{x:2,y:3}),{font:0.8,color:'#A0A0F0'})
    back.line(util.sum(GraphOrigin,{x:0,y:3.8}),util.sum(GraphOrigin,{x:50,y:3.8}),{width:0.05,opacity:0.6})
    back.text('Section',util.sum(GraphOrigin,{x:2,y:5}),{font:0.8,color:'#A0A0F0'})
    back.line(util.sum(GraphOrigin,{x:0,y:5.8}),util.sum(GraphOrigin,{x:50,y:5.8}),{width:0.05,opacity:0.6})

    for (var x = 5; x <= 50; x+=5) {
        back.line(util.sum(GraphOrigin,{x:x,y:0}),util.sum(GraphOrigin,{x:x,y:-25}),{width:0.03,opacity:0.4})
    }
    for (var y = -5; -25 <= y; y-=5) {
        back.line(util.sum(GraphOrigin,{x:0,y:y}),util.sum(GraphOrigin,{x:50,y:y}),{width:0.03,opacity:0.4})
    }
    writeInfo()
}


function writeInfo(){
    info.clear()
    for (var x = 0; x <= 50; x+=5) {
        info.text((tickOffset+x*2)+'tick',util.sum(GraphOrigin,{x:x,y:0.5}),{font:0.6,color:'#A0A0F0'})
    }
    for (var y = 0; -25 <= y; y-=5) {
        info.text((y*-2)+'ms',util.sum(GraphOrigin,{x:-1,y:y}),{font:0.6,color:'#A0A0F0'})
    }
}

export function start() {
    if(!isInit){
        init();
        isInit=true;
    }
    const tick = getTicks()
    if(100<tick - tickOffset){
        tickOffset += 100
        graph.clear()
        writeInfo()
    }
    lastLap = 0
}
export function end() {
    //lap処理
    {
        const x = (getTicks() - tickOffset) / 2
        const lastCpuMs = lastLap / 1000000.0
        const currentCpuMs = getCpuTime() / 1000000.0
        const deltaCpuMs = currentCpuMs - lastCpuMs
        graph.rect(util.sum(GraphOrigin,{x:x-0.45,y:-lastCpuMs/2}),0.4,-deltaCpuMs/2,{fill:'#808080',opacity:0.8})
    }

    //section処理
    {
        let x = (getTicks() - tickOffset) / 2 -0.44
        for(const key in sectionTable){
            const value = sectionTable[key]
            graph.rect(util.sum(GraphOrigin,{x:x,y:0}),0.04,-value.time/2,{fill:value.color,opacity:0.8})
            value.time = 0
            x+=0.05
    }
    }
    
}