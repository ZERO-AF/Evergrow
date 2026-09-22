/** Vehicle silhouettes for the transport network (wayfinder world-t04):
 * simple readable shapes drawn in world space — a hull for ships, a balloon +
 * gondola for zeppelins, a shell for the turtle boat, a car for the tram and a
 * winged taxi for flight rides. */
import { VEHICLE_DEFS, type VehicleKind } from './transport-content.ts';
import type { VehicleMarker } from './transport.ts';

export function drawTransport(c: CanvasRenderingContext2D, marker: VehicleMarker, time: number): void {
  c.save();
  c.translate(marker.x, marker.y);
  c.rotate(marker.angle);
  const bob = marker.docked ? 0 : Math.sin(time * 2.2) * 2;
  if (marker.kind === 'flight') {
    // Winged taxi: body + two wing strokes.
    c.translate(0, bob - 18);
    c.fillStyle = '#8a6f4d';
    c.beginPath(); c.ellipse(0, 0, 16, 7, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#d8c593'; c.lineWidth = 5; c.lineCap = 'round';
    const flap = Math.sin(time * 9) * .5;
    c.beginPath(); c.moveTo(-2, -2); c.quadraticCurveTo(-22, -16 - flap * 10, -36, -8 - flap * 14); c.stroke();
    c.beginPath(); c.moveTo(-2, 2); c.quadraticCurveTo(-22, 16 + flap * 10, -36, 8 + flap * 14); c.stroke();
    c.restore();
    return;
  }
  const def = VEHICLE_DEFS[marker.kind as VehicleKind];
  c.translate(0, bob);
  if (marker.kind === 'zeppelin') {
    // Balloon above, gondola below.
    c.fillStyle = def.hull;
    c.beginPath(); c.ellipse(0, -46, 58, 22, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = def.accent;
    c.beginPath(); c.ellipse(0, -46, 58, 8, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = def.hull; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-24, -28); c.lineTo(-14, -6); c.moveTo(24, -28); c.lineTo(14, -6); c.stroke();
    c.fillStyle = '#3a2f28';
    c.fillRect(-18, -8, 36, 12);
  } else if (marker.kind === 'turtle') {
    // Giant turtle shell + head, riding low in the water.
    c.fillStyle = def.hull;
    c.beginPath(); c.ellipse(0, 0, 52, 34, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = def.accent;
    c.beginPath(); c.ellipse(0, -4, 40, 24, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = def.hull;
    c.beginPath(); c.ellipse(56, 0, 12, 8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2e3a26';
    c.fillRect(-16, -30, 32, 10); // deck hut
  } else if (marker.kind === 'tram') {
    // Docked trams sit inside a stone depot: platform edge, a squat tunnel
    // mouth behind the car, and signal lamps. The car overlaps the arch so it
    // reads as emerging from the tunnel rather than parked in open snow.
    if (marker.docked) {
      c.fillStyle = '#2b2823';
      c.fillRect(-52, 8, 104, 10);                                    // platform edge
      c.fillStyle = '#46413a';
      c.beginPath(); c.roundRect(-46, -52, 92, 62, 6); c.fill();      // depot block
      c.fillStyle = '#57504a';
      c.fillRect(-46, -52, 92, 10);                                   // lintel band
      c.fillStyle = '#0d0b09';
      c.beginPath();                                                  // tunnel mouth
      c.moveTo(-26, 10); c.lineTo(-26, -22);
      c.arc(0, -22, 26, Math.PI, 0);
      c.lineTo(26, 10); c.closePath(); c.fill();
      const lamp = .55 + Math.sin(time * 3.1) * .25;
      c.fillStyle = `rgba(255,190,110,${lamp.toFixed(3)})`;
      c.beginPath(); c.arc(-38, -40, 3, 0, Math.PI * 2); c.arc(38, -40, 3, 0, Math.PI * 2); c.fill();
    }
    // Low armored car with a lit window band.
    c.fillStyle = def.hull;
    c.beginPath(); c.roundRect(-34, -12, 68, 24, 6); c.fill();
    c.fillStyle = def.accent;
    c.fillRect(-26, -6, 52, 8);
  } else {
    // Ship: hull + mast + sail.
    c.fillStyle = def.hull;
    c.beginPath();
    c.moveTo(-52, 0); c.quadraticCurveTo(-40, 22, 0, 24); c.quadraticCurveTo(40, 22, 52, 0);
    c.lineTo(40, -8); c.lineTo(-40, -8); c.closePath(); c.fill();
    c.strokeStyle = '#3a2f28'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(0, -8); c.lineTo(0, -52); c.stroke();
    c.fillStyle = def.accent;
    c.beginPath(); c.moveTo(2, -50); c.quadraticCurveTo(26, -34, 4, -12); c.closePath(); c.fill();
  }
  c.restore();
}
