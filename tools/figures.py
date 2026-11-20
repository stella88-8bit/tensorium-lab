"""Generate original SVGs for the loss surface and the three study tracks."""
from math import sin, cos, exp
from pathlib import Path
from random import Random

OUT = Path(__file__).resolve().parents[1] / 'dist/assets'


def point(t):
    return ','.join(f'{n:.1f}' for n in t)


def curve(pts, **attrs):
    attr = ' '.join(f'{k.replace("_", "-")}="{v}"' for k,v in attrs.items())
    return f'<polyline points="{" ".join(map(point,pts))}" fill="none" {attr}/>'


def circle(x,y,r,fill,other=''):
    return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{fill}" {other}/>'


def drawing(name,w,h,body):
    (OUT / name).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">'+''.join(body)+'</svg>')


def loss(x,y):
    return .08 + 1.23*exp(-((x+.60)**2/.45+(y-.24)**2/.58)) + 1.85*exp(-((x-.12)**2/.30+(y+.66)**2/.32)) + 1.05*exp(-((x-.96)**2/.44+(y-.58)**2/.56)) + .13*(x*x + y*y)


def project(x,y,z):
    return 284 + 96*x - 67*y, 206 + 25*x + 34*y - 86*z


def terrain():
    rng=Random(72)
    draw=['<defs><radialGradient id="gl"><stop stop-color="#8172fe" stop-opacity=".32"/><stop offset="1" stop-color="#8172fe" stop-opacity="0"/></radialGradient></defs><ellipse cx="310" cy="170" rx="255" ry="145" fill="url(#gl)"/>']
    for _ in range(100):
        draw.append(circle(rng.randrange(24,555),rng.randrange(12,295),round(rng.uniform(.42,1.04),2),'#b6acf8',f'opacity="{rng.uniform(.17,.58):.2f}"'))
    # Back-to-front fill removes hidden grid lines and gives the field volume.
    n=44
    coords=[-1.5+i*3/n for i in range(n+1)]
    order=sorted(((i,j) for i in range(n) for j in range(n)),key=lambda ij:25*ij[0]+34*ij[1])
    for i,j in order:
        x,y=coords[i],coords[j]
        corners=[(x,y),(coords[i+1],y),(coords[i+1],coords[j+1]),(x,coords[j+1])]
        h=loss(x,y); v=min(1,h/1.98)
        fill=f'rgb({int(30+56*v)},{int(26+33*v)},{int(68+94*v)})'
        stroke=f'rgb({int(91+88*v)},{int(81+75*v)},{int(176+66*v)})'
        pts=' '.join(point(project(a,b,loss(a,b))) for a,b in corners)
        draw.append(f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width=".74" stroke-linejoin="round"/>')
    for x,y in [(-.58,.23),(.12,-.65),(.93,.61)]:
        px,py=project(x,y,loss(x,y)); draw.extend([circle(px,py,4.5,'#d7cbff','opacity=".26"'),circle(px,py,1.8,'#efe8ff')])
    drawing('landscape.svg',570,330,draw)


def tracks():
    for idx,(name,ink) in enumerate([('base','#228f89'),('ml','#5273c3'),('deep','#8465c9')]):
        draw=['<defs><pattern id="dots" width="13" height="13" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".75" fill="'+ink+'" opacity=".23"/></pattern></defs><rect width="400" height="145" fill="url(#dots)"/>']
        if idx==0:
            # Three sliced coordinate planes show how arrays acquire a third dimension.
            for level in range(3):
                z=23*level
                def iso(u,v): return (190+11.8*u-11.8*v,85+5.6*u+5.6*v-z)
                pts=[iso(-3,-3),iso(3,-3),iso(3,3),iso(-3,3)]
                draw.append('<polygon points="'+' '.join(map(point,pts))+'" fill="#c2e8dd" stroke="'+ink+'" stroke-width="1.3"/>')
                for t in range(-2,3):
                    draw.append(curve([iso(t,-3),iso(t,3)],stroke=ink,stroke_width='.72',opacity='.75'))
                    draw.append(curve([iso(-3,t),iso(3,t)],stroke=ink,stroke_width='.72',opacity='.75'))
        elif idx==1:
            draw.append(curve([(115,17),(115,116),(294,116)],stroke=ink,stroke_width='1.25'))
            draw.append(curve([(121,102),(278,30)],stroke=ink,stroke_width='1.7'))
            draw.append(curve([(126,92),(277,24)],stroke=ink,stroke_dasharray='4 5',opacity='.5'))
            rand=Random(19)
            for _ in range(66):
                x=rand.uniform(128,280); y=100-(x-128)*.44+rand.gauss(0,13); draw.append(circle(x,y,round(rand.uniform(1.45,3.1),2),ink,f'opacity="{rand.uniform(.45,.95):.2f}"'))
        else:
            layers=[[(120,44),(120,91)],[(164,23),(164,66),(164,109)],[(212,19),(212,53),(212,86),(212,120)],[(260,42),(260,94)],[(299,68)]]
            for prev,nxt in zip(layers,layers[1:]):
                for a in prev:
                    for b in nxt: draw.append(curve([a,b],stroke=ink,stroke_width='1',opacity='.55'))
            for k,layer in enumerate(layers):
                for x,y in layer:
                    draw.append(circle(x,y,5.4,'#eae2fc',f'stroke="{ink}" stroke-width="1.6"'))
                    draw.append(circle(x,y,2.15,ink))
        drawing('track-'+name+'.svg',400,145,draw)

if __name__=='__main__':
    terrain()
    tracks()
