export const visualizerShader = /* wgsl */ `
struct Params { time: f32, mode: f32, hue: f32, glow: f32, energy: f32, aspect: f32, bass: f32, mid: f32, treble: f32 }
@group(0) @binding(0) var<uniform> params: Params;
fn palette(x: f32) -> vec3f {
  return .52 + .48 * cos(6.28318 * (vec3f(.0,.33,.67) + x + params.hue));
}
fn hash(n: f32) -> f32 { return fract(sin(n*127.1)*43758.5453); }
fn rotate(p: vec2f, a: f32) -> vec2f {
  return vec2f(cos(a)*p.x-sin(a)*p.y,sin(a)*p.x+cos(a)*p.y);
}
fn field(q: vec3f) -> f32 {
  var p = q;
  let xz = rotate(p.xz, params.time*.22);
  p = vec3f(xz.x,p.y,xz.y);
  let xy = rotate(p.xy, params.time*.15);
  p = vec3f(xy,p.z);
  let torus = length(vec2f(length(p.xz)-(.73+params.bass*.2),p.y))-(.22+params.mid*.09);
  let orb = length(p-vec3f(sin(params.time*.6)*.62,cos(params.time*.4)*.4,0))-(.43+params.treble*.14);
  let h = clamp(.5+.5*(orb-torus)/.38,0.,1.);
  return mix(orb,torus,h)-.38*h*(1.-h);
}
fn normal(p: vec3f) -> vec3f {
  let e = vec2f(.002,0.);
  return normalize(vec3f(field(p+e.xyy)-field(p-e.xyy),field(p+e.yxy)-field(p-e.yxy),field(p+e.yyx)-field(p-e.yyx)));
}
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = (uv-.5)*vec2f(params.aspect,1.)*2.;
  let t = params.time;
  var col = vec3f(0.);
  let mode = i32(params.mode);
  if (mode == 1) {
    let ro = vec3f(0.,0.,3.1);
    let rd = normalize(vec3f(p,-2.5));
    var d = 0.;
    for(var i=0; i<60; i++) { let step = field(ro+rd*d); d += step; if(abs(step)<.001 || d>6.) { break; } }
    if(d<6.) {
      let hit = ro+rd*d; let n = normal(hit); let r = reflect(rd,n);
      let band = pow(.5+.5*sin(r.y*15.+r.x*3.),12.);
      let rim = pow(1.-max(dot(n,-rd),0.),3.);
      let light = pow(max(dot(r,normalize(vec3f(-.5,.8,1.))),0.),40.);
      col = palette(r.y*.15+t*.025)*(.16+.42*max(n.y,0.)) + vec3f(band*.85+light*2.) + palette(r.x*.2+.2)*rim*.9;
    }
    col += palette(.6)*.025/(.15+abs(length(p*vec2f(.8,1.))-1.));
  } else if(mode == 2) {
    col = vec3f(.004,.012,.025);
    for(var i=0.;i<5.;i+=1.) {
      let k = i/5.;
      let x = p.x+sin(t*.11+k*3.)*.18;
      let fold = sin(x*2.1+t*.18+k*2.)*.22+sin(x*4.3-t*.13+k)*.08;
      let edge = p.y-(.2+fold+k*.11);
      let height = .28+.12*sin(x*2.-t*.17+k)+params.bass*.08;
      let veil = exp(-max(-edge,0.)/height)*(1.-smoothstep(-.035,.035,edge));
      let strands = .75+.15*sin(x*68.+sin(x*7.-t*.3)*3.+k*13.);
      let taper = exp(-pow(abs(x)/1.35,4.));
      let green = mix(vec3f(.07,.85,.46),vec3f(.18,.48,.87),k);
      let crown = mix(vec3f(.24,.1,.48),green,exp(-abs(edge)*4.));
      col += crown*veil*strands*taper*(.25+params.mid*.08);
      col += green*exp(-abs(edge)*100.)*.12*taper;
    }
  } else if(mode == 4) {
    let q = p-vec2f(sin(t*.12)*.12,cos(t*.09)*.08);
    let radius = max(length(q),.035);
    let angle = atan2(q.y,q.x);
    let depth = 1./radius;
    let travel = depth-t*.8;
    let aa = max(fwidth(travel),.012);
    let ringDistance = abs(fract(travel*.8)-.5)/.8;
    let rings = 1.-smoothstep(.014,.014+aa,ringDistance);
    let twist = angle+depth*.055+sin(t*.12)*.16;
    let railDistance = abs(sin(twist*8.))*radius;
    let rails = 1.-smoothstep(.002,.002+fwidth(railDistance)*1.5,railDistance);
    let fade = smoothstep(.06,.5,radius);
    let light = .5+.5*cos(twist-1.);
    col = mix(vec3f(.025,.11,.3),vec3f(.1,.64,.9),light)*(rings*.75+rails*.4)*fade;
    col += vec3f(.045,.17,.32)*exp(-radius*3.)*.25;
    for(var i=0.;i<28.;i+=1.) {
      let a = hash(i+43.)*6.28318;
      let z = .18+fract(hash(i+9.)-t*.11)*4.;
      let center = vec2f(cos(a),sin(a))*.8/z;
      let d = p-center;
      let along = dot(d,normalize(center));
      let side = dot(d,vec2f(-sin(a),cos(a)));
      col += vec3f(.25,.65,1.)*exp(-side*side/.000012-along*along/(.001/z))*smoothstep(.18,.5,z)*.65;
    }
  } else if(mode == 5) {
    for(var i=0.;i<3.;i+=1.) {
      let phase = t*.24+i*1.7;
      let x = p.x;
      let center = sin(x*1.8+phase)*.3+sin(x*3.1-phase*.7)*.1+(i-1.)*.15;
      let width = .025+.12*pow(.5+.5*sin(x*2.+phase+1.),2.)+params.bass*.025;
      let crossSection = (p.y-center)/width;
      let body = exp(-pow(abs(crossSection),4.)*1.8);
      let sheen = exp(-pow((crossSection+.36)*5.,2.));
      let edge = exp(-pow((abs(crossSection)-.85)*22.,2.));
      let taper = exp(-pow(abs(x)/1.3,6.));
      let silk = mix(vec3f(.035,.32,.42),vec3f(.52,.28,.16),i/2.);
      col += (silk*body*(.38+.4*crossSection)+mix(silk,vec3f(.8,.9,1.),.6)*sheen*.45+silk*edge*.3)*taper;
      col += silk*exp(-abs(p.y-center)*12.)*.07*taper;
    }
  } else if(mode == 6) {
    col = vec3f(.003,.006,.014);
    let drift = vec2f(sin(t*.07),cos(t*.06))*.055;
    for(var i=0.;i<120.;i+=1.) {
      let angle = hash(i*3.+1.)*6.28318;
      let spread = .25+hash(i*3.+2.)*2.6;
      let z = .2+fract(hash(i*3.+3.)-t*.055)*4.;
      let center = vec2f(cos(angle),sin(angle))*spread/z+drift;
      let delta = p-center;
      let along = dot(delta,vec2f(cos(angle),sin(angle)));
      let side = dot(delta,vec2f(-sin(angle),cos(angle)));
      let size = .0024+.003/z;
      let trail = .003+.018/(z*z);
      let core = exp(-dot(delta,delta)/(size*size));
      let streak = exp(-side*side/(size*size)-pow((along+trail)/trail,2.))*.32;
      let fade = smoothstep(.2,.5,z)*(1.-smoothstep(3.3,4.2,z));
      let tint = mix(vec3f(.55,.72,1.),vec3f(1.,.88,.7),hash(i+600.));
      col += tint*(core+streak)*fade*(.9+hash(i+300.)*.8+params.treble*.2);
    }
  }
  if(mode != 1) {
    let axis = normalize(vec3f(1.));
    let angle = params.hue*6.28318;
    col = col*cos(angle)+cross(axis,col)*sin(angle)+axis*dot(axis,col)*(1.-cos(angle));
  }
  let vignette = 1.-smoothstep(.55,1.6,length(p*.75));
  col *= vignette*params.glow*(.85+params.energy*.15);
  col = vec3f(1.)-exp(-max(col,vec3f(0.))*1.35);
  return vec4f(pow(col,vec3f(.85)),1.);
}
`;
