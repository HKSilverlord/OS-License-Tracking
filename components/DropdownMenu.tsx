import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface DropdownMenuProps {
    isOpen: boolean;
    onClose: () => void;
    triggerRef: React.RefObject<HTMLElement>;
    children: React.ReactNode;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ isOpen, onClose, triggerRef, children }) => {
    const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const updatePosition = () => {
                const rect = triggerRef.current?.getBoundingClientRect();
                if (rect) {
                    const spaceBelow = window.innerHeight - rect.bottom;
                    const MENU_HEIGHT_ESTIMATE = 200; // conservative estimate for 4-5 items
                    const showAbove = spaceBelow < MENU_HEIGHT_ESTIMATE && rect.top > MENU_HEIGHT_ESTIMATE;

                    // Align right edge of menu with right edge of trigger
                    const left = rect.right - 128; // 128px is approx menu width (w-32)

                    if (showAbove) {
                        setPosition({
                            bottom: window.innerHeight - rect.top + 4,
                            left: left
                        });
                    } else {
                        setPosition({
                            top: rect.bottom + 4,
                            left: left
                        });
                    }
                }
            };

            updatePosition();

            // Update on scroll or resize
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);

            return () => {
                window.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
            };
        }
    }, [isOpen, triggerRef]);

    // Click outside to close
    useEffect(() => {
        if (isOpen) {
            const handleClickOutside = (event: MouseEvent) => {
                if (
                    menuRef.current &&
                    !menuRef.current.contains(event.target as Node) &&
                    !triggerRef.current?.contains(event.target as Node)
                ) {
                    onClose();
                }
            };

            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen, onClose, triggerRef]);

    if (!isOpen || !position) return null;

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-lg w-32 py-1"
            style={{
                top: position.top !== undefined ? `${position.top}px` : 'auto',
                bottom: position.bottom !== undefined ? `${position.bottom}px` : 'auto',
                left: `${position.left}px`,
            }}
        >
            {children}
        </div>,
        document.body
    );
};
