const groomHand = document.getElementById('groomhand');
const brideHand = document.getElementById('bridehand');
const groomHandCut = document.getElementById('groomhandcut');
const topText = document.querySelector('.top-text');

const joinUs = document.getElementById('joinus');
const dateDetail = document.getElementById('dateDetail');
const timeDetail = document.getElementById('timeDetail');
const namesText = document.getElementById('namesText');
const locationDetail = document.getElementById('locationDetail');

// TOTAL "scroll budget" the whole animation needs — raise/lower this to change length
const TOTAL_SCROLL = 2000; // px

let virtualScroll = 0;
let locked = true;

document.body.classList.add('locked');

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function stageProgress(v, start, end) {
    return clamp((v - start) / (end - start), 0, 1);
}

function applyStage(el, p, { slideX = 0, slideY = 30 } = {}) {
    el.style.opacity = p;
    const x = slideX * (1 - p);
    const y = slideY * (1 - p);
    el.style.transform = `translate(${x}px, ${y}px)`;
}

function update() {
  const progress = clamp(virtualScroll / (TOTAL_SCROLL * 1), 0, .380); // hands use first 40% of budget

  // only recalculate hand transforms while still animating — freeze once fully in position
  if (progress < 1) {
    const startOffset = 60;
    const startOffsetY = -40;

    const groomX = -startOffset * (1 - progress);
    const brideX = startOffset * (1 - progress);
    const brideY = startOffsetY * (1 - progress);

groomHand.style.transform = `translateX(${groomX}vw) translate(160px, 195px)`;
// brideHand.style.transform = `translate(${brideX}vw, ${brideY}vh) translate(-160px, 350px)`;
brideHand.style.transform = `translate(${brideX}vw, ${brideY}vh) translate(-200px, 400px) rotate(8deg)`;
groomHandCut.style.transform = `translateX(${groomX}vw) translate(185px, 160px)`;
  }

  // --- staged text reveal, spread across the FULL scroll budget ---
  const STAGE_SIZE = TOTAL_SCROLL / 5; // 5 stages, evenly split

  const s1 = stageProgress(virtualScroll, STAGE_SIZE * 0, STAGE_SIZE * 1); // Join Us
  const s2 = stageProgress(virtualScroll, STAGE_SIZE * 1, STAGE_SIZE * 2); // Date
  const s3 = stageProgress(virtualScroll, STAGE_SIZE * 2, STAGE_SIZE * 3); // Time
  const s4 = stageProgress(virtualScroll, STAGE_SIZE * 3, STAGE_SIZE * 4); // Names
  const s5 = stageProgress(virtualScroll, STAGE_SIZE * 4, STAGE_SIZE * 5); // Location

  applyStage(joinUs,     s1, { slideX: 0,   slideY: 30 });
  applyStage(dateDetail, s2, { slideX: -80, slideY: 20 });
  applyStage(timeDetail, s3, { slideX: 80,  slideY: 20 });
  applyStage(namesText,  s4, { slideX: 0,   slideY: 30 });
  applyStage(locationDetail, s5, { slideX: 0, slideY: 0 });

  const textFade = 1 - progress * 0.4;
  const textLift = progress * 30;
  topText.style.opacity = textFade;
  topText.style.transform = `translateY(${-textLift}px)`;

  // unlock page scroll once the full sequence has played out
  if (virtualScroll >= TOTAL_SCROLL && locked) {
    locked = false;
    document.body.classList.remove('locked');
  }
  if (virtualScroll < TOTAL_SCROLL && !locked) {
    locked = true;
    document.body.classList.add('locked');
  }
}

window.addEventListener('wheel', (e) => {
  if (locked) {
    e.preventDefault();
    virtualScroll = clamp(virtualScroll + e.deltaY, 0, TOTAL_SCROLL);
    update();
  } else if (window.scrollY <= 0 && e.deltaY < 0) {
    // at top of page and scrolling up further — re-enter the hero animation
    e.preventDefault();
    locked = true;
    document.body.classList.add('locked');
    virtualScroll = clamp(virtualScroll + e.deltaY, 0, TOTAL_SCROLL);
    update();
  }
}, { passive: false });

let touchStartY = 0;
window.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  const touchY = e.touches[0].clientY;
  const delta = touchStartY - touchY;

  if (locked) {
    e.preventDefault();
    virtualScroll = clamp(virtualScroll + delta, 0, TOTAL_SCROLL);
    touchStartY = touchY;
    update();
  } else if (window.scrollY <= 0 && delta < 0) {
    e.preventDefault();
    locked = true;
    document.body.classList.add('locked');
    virtualScroll = clamp(virtualScroll + delta, 0, TOTAL_SCROLL);
    touchStartY = touchY;
    update();
  }
}, { passive: false });

update();