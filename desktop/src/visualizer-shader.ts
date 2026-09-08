export const visualizerShader = /* wgsl */ `
struct Params { time: f32, mode: f32, hue: f32, glow: f32, energy: f32, aspect: f32 }
@group(0) @binding(0) var<uniform> params: Params;
fn palette(x: f32) -> vec3f {
  return .52 + .48 * cos(6.28318 * (vec3f(.0,.33,.67) + x + params.hue));
}
fn rotate(p: vec2f, a: f32) -> vec2f {
  return vec2f(cos(a)*p.x-sin(a)*p.y,sin(a)*p.x+cos(a)*p.y);
}
fn field(q: vec3f) -> f32 {
  var p = q;
  let xz = rotate(p.xz, params.time*.22);
  p = vec3f(xz.x,p.y,xz.y);
  let xy = rotate(p.xy, params.time*.15);
  p = vec3f(xy,p.z);
  let torus = length(vec2f(length(p.xz)-.73,p.y))-.22;
  let orb = length(p-vec3f(sin(params.time*.6)*.62,cos(params.time*.4)*.4,0))-.43;
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
    for(var i=0.; i<16.; i+=1.) {
      let depth = i/16.;
      let y = sin(p.x*2.+t*.24+depth*3.)*.23 + sin(p.x*4.5-t*.18+depth)*.12;
      let curtain = exp(-abs(p.y-y+depth*.4-.2)*(9.+depth*16.));
      let ribs = .5+.5*sin(p.x*36.+sin(p.x*9.+t)*2.+depth*3.);
      col += palette(depth*.22+.35)*curtain*(.075+ribs*.085)*(1.-depth);
    }
  } else if(mode == 4) {
    let radius = max(length(p),.025); let angle = atan2(p.y,p.x);
    let depth = 1.2/radius+t*.45;
    let ring = pow(.5+.5*cos(depth*9.),22.);
    let spoke = pow(.5+.5*cos(angle*10.+sin(depth*.35+t*.2)),35.);
    col = palette(depth*.03+angle*.07)*(.025+ring*.9+spoke*.55)*smoothstep(.04,.32,radius);
    col *= .65+.35*sin(depth*.8);
  } else if(mode == 5) {
    for(var i=0.;i<7.;i+=1.) {
      let k = i*.3;
      let y = sin(p.x*2.5+t*.35+k)*.34+cos(p.x*4.-t*.25+k)*.16;
      let dist = abs(p.y-y-(i-3.)*.055);
      col += palette(k*.22+t*.025)*(.0025/(dist+.007)+.2*exp(-dist*45.));
    }
  } else if(mode == 6) {
    for(var i=0; i<70; i++) {
      let id = f32(i);
      let angle = id*2.39996;
      let radius = .3+fract(id*.618)*1.8;
      let z = .25+fract(id*.137-t*.14)*3.;
      let center = vec2f(cos(angle),sin(angle))*radius/z;
      let delta = p-center;
      let distance = length(delta);
      let streak = abs(dot(delta,normalize(center)));
      let side = abs(dot(delta,vec2f(-sin(angle),cos(angle))));
      let star = .7*exp(-distance*distance*18000.) + .28*exp(-side*side*24000.-streak*80.*z);
      col += palette(id*.03)*star;
    }
    col += palette(.45)*.009/(length(p)+.15);
  }
  let vignette = 1.-smoothstep(.55,1.6,length(p*.75));
  col *= vignette*params.glow*(.85+params.energy*.15);
  col = vec3f(1.)-exp(-max(col,vec3f(0.))*1.35);
  return vec4f(pow(col,vec3f(.85)),1.);
}
`;
