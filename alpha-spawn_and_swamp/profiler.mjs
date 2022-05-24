import {arenaInfo} from 'game';
import {getCpuTime,getTicks} from 'game/utils';
import {Visual} from '/game/visual';
import * as util from './utils';



const back = new Visual(0,true)
const info = new Visual(0,true)
const graph = new Visual(0,true)

//グラフの原点
const GraphOrigin = {x:103,y:25}

let tickOffset = 0
let lastLap

export function lap(name) {
    const x = (getTicks() - tickOffset) / 2
    const lastCpuMs = lastLap / 1000000.0
    const currentCpuMs = getCpuTime() / 1000000.0
    const deltaCpuMs = currentCpuMs - lastCpuMs


    graph.line(util.sum(GraphOrigin,{x:x,y:-lastCpuMs/2}),util.sum(GraphOrigin,{x:x,y:-currentCpuMs/2}))

    //console.log("lap",name,deltaCpuMs,"ms")

    lastLap = getCpuTime()
}

let isInit
function init(){
    back.line(GraphOrigin,util.sum(GraphOrigin,{x:50,y:0}),{width:0.05,opacity:1})
    back.line(GraphOrigin,util.sum(GraphOrigin,{x:0,y:-22}),{width:0.05,opacity:1})

    for (var x = 5; x <= 50; x+=5) {
        back.line(util.sum(GraphOrigin,{x:x,y:0}),util.sum(GraphOrigin,{x:x,y:-20}),{width:0.03,opacity:0.4})
    }
    for (var y = -5; -20 <= y; y-=5) {
        back.line(util.sum(GraphOrigin,{x:0,y:y}),util.sum(GraphOrigin,{x:50,y:y}),{width:0.03,opacity:0.4})
    }
    writeInfo()
}

let origin = 0

function writeInfo(){
    info.clear()
    for (var x = 0; x <= 50; x+=5) {
        info.text((tickOffset+x*2)+'tick',util.sum(GraphOrigin,{x:x,y:0.5}),{font:0.6,color:'#A0A0F0'})
    }
    for (var y = 0; -20 <= y; y-=5) {
        info.text((y*-2)+'ms',util.sum(GraphOrigin,{x:-1,y:y}),{font:0.6,color:'#A0A0F0'})
    }
}

export function update() {
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
