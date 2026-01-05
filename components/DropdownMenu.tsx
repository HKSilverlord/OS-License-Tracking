import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface DropdownMenuProps {
    isOpen: boolean;
    onClose: () => void;
    triggerRef: React.RefObject<HTMLElement>;
    children: React.ReactNode;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ isOpen, onClose, triggerRef, children }) => {
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const updatePosition = () => {
                const rect = triggerRef.current?.getBoundingClientRect();
                if (rect) {
                    // Align right edge of menu with right edge of trigger, and place below
                    // We need to wait for render to get menu width, or default to some width
                    // For now, let's just position it relative to the trigger
                    setPosition({
                        top: rect.bottom + window.scrollY + 4, // 4px gap
                        left: rect.right + window.scrollX - 128 // 128px is approx menu width (w-32)
                    });
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
                top: `${position.top - window.scrollY}px`,
                left: `${position.left - window.scrollX}px`,
            }}
        >
            {children}
        </div>,
        document.body
    );
};
