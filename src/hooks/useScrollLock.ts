import { useEffect, useRef } from 'react';

let activeLocks = 0;

export function unlockScroll() {
  activeLocks = 0;
  document.body.classList.remove('modal-open');
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';

  const tabContainers = document.querySelectorAll(
    '.absolute.inset-0.overflow-y-auto, main > div > div.overflow-y-auto, [data-scroll-container]'
  );
  tabContainers.forEach((container) => {
    (container as HTMLElement).style.overflowY = '';
  });
}

export function forceUnlockScroll() {
  unlockScroll();
  requestAnimationFrame(unlockScroll);
  setTimeout(unlockScroll, 50);
  setTimeout(unlockScroll, 200);
  setTimeout(unlockScroll, 350);
}

export function useScrollLock(isOpen: boolean) {
  const isLockedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      if (!isLockedRef.current) {
        isLockedRef.current = true;
        activeLocks++;
        document.body.classList.add('modal-open');
        document.body.style.overflow = 'hidden';

        const tabContainers = document.querySelectorAll(
          '.absolute.inset-0.overflow-y-auto, main > div > div.overflow-y-auto'
        );
        tabContainers.forEach((container) => {
          (container as HTMLElement).style.overflowY = 'hidden';
        });
      }
    } else {
      if (isLockedRef.current) {
        isLockedRef.current = false;
        activeLocks = Math.max(0, activeLocks - 1);
        if (activeLocks === 0) {
          unlockScroll();
        }
      }
    }

    return () => {
      if (isLockedRef.current) {
        isLockedRef.current = false;
        activeLocks = Math.max(0, activeLocks - 1);
        if (activeLocks === 0) {
          unlockScroll();
          setTimeout(() => {
            if (activeLocks === 0) {
              unlockScroll();
            }
          }, 300);
        }
      }
    };
  }, [isOpen]);
}
