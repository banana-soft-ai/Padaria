import React, { useEffect, useRef } from 'react';
import { XCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

interface ToastProps {
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onClose: () => void;
    duration?: number; // Duração em milissegundos, padrão 5000ms
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 4000 }) => {
    const baseClasses = "fixed bottom-4 right-4 p-4 rounded-lg shadow-lg flex items-center space-x-3 z-[9999]";
    let typeClasses = "";
    let Icon = Info;

    switch (type) {
        case 'success':
            typeClasses = "bg-green-500 text-white";
            Icon = CheckCircle;
            break;
        case 'error':
            typeClasses = "bg-red-500 text-white";
            Icon = XCircle;
            break;
        case 'warning':
            typeClasses = "bg-yellow-500 text-white";
            Icon = AlertTriangle;
            break;
        case 'info':
        default:
            typeClasses = "bg-blue-500 text-white";
            Icon = Info;
            break;
    }

    // Mantém uma ref estável para onClose para evitar que o timer seja reiniciado
    // a cada render quando onClose é recriado pelo pai.
    const onCloseRef = useRef(onClose)
    useEffect(() => { onCloseRef.current = onClose }, [onClose])

    useEffect(() => {
        const timer = setTimeout(() => {
            try { onCloseRef.current() } catch (e) { /* ignore */ }
        }, duration);
        return () => clearTimeout(timer);
    }, [duration]);

    return (
        <div className={`${baseClasses} ${typeClasses}`}>
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm font-medium flex-grow">{message}</span>
            <button
                onClick={onClose}
                className="ml-auto p-1 rounded-full hover:bg-white hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                aria-label="Fechar notificação"
            >
                <XCircle className="h-4 w-4" />
            </button>
        </div>
    );
};

export default Toast;