import React, { useState } from 'react';
import { HazardData } from '../types';
import { X, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { patchReportStatus } from '../src/api/adminApi';

interface ActionReportModalProps {
    data: HazardData;
    onClose: () => void;
    onStatusChange: (newStatus: "new" | "processing" | "done") => void;
}

const ActionReportModal: React.FC<ActionReportModalProps> = ({ data, onClose, onStatusChange }) => {
    // 현재 상태를 소문자 기준으로 변환하여 초기값 설정
    const initialStatus = data.status === 'Done' ? 'done' : data.status === 'Processing' ? 'processing' : 'new';
    const [selectedStatus, setSelectedStatus] = useState<"new" | "processing" | "done">(initialStatus);
    const [reason, setReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!reason.trim()) return; // 사유 필수 입력

        setIsSubmitting(true);
        try {
            await patchReportStatus(data.id, selectedStatus);
            onStatusChange(selectedStatus); // App.tsx 등 최상단 상태 업데이트용
            onClose(); // 성공 시 모달 닫기
        } catch (err) {
            console.error("Failed to update status", err);
            alert("상태 변경에 실패했습니다. 다시 시도해주세요.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border dark:border-slate-700 transition-colors duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">조치 보고서 작성</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    </button>
                </div>

                {/* 본문 */}
                <div className="p-6 space-y-6">
                    {/* 상태 토글 선택기 */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">상태 변경</label>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => setSelectedStatus('new')}
                                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${selectedStatus === 'new'
                                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-red-300 text-slate-500'
                                    }`}
                            >
                                <AlertTriangle className="w-5 h-5 mb-1" />
                                <span className="text-xs font-bold">New</span>
                            </button>

                            <button
                                onClick={() => setSelectedStatus('processing')}
                                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${selectedStatus === 'processing'
                                    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-yellow-300 text-slate-500'
                                    }`}
                            >
                                <Clock className="w-5 h-5 mb-1" />
                                <span className="text-xs font-bold">Processing</span>
                            </button>

                            <button
                                onClick={() => setSelectedStatus('done')}
                                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${selectedStatus === 'done'
                                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-green-300 text-slate-500'
                                    }`}
                            >
                                <CheckCircle className="w-5 h-5 mb-1" />
                                <span className="text-xs font-bold">Done</span>
                            </button>
                        </div>
                    </div>

                    {/* 변경 사유 텍스트 영역 */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                            변경 사유 <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="상태를 변경하는 상세한 사유와 조치 내역을 입력해주세요."
                            className="w-full h-32 p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                        ></textarea>
                    </div>
                </div>

                {/* 하단 버튼 */}
                <div className="flex bg-slate-50 dark:bg-slate-800/50 p-4 border-t border-slate-100 dark:border-slate-800 gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-lg font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!reason.trim() || isSubmitting}
                        className={`flex-1 px-4 py-2.5 rounded-lg font-bold text-white transition-all shadow-sm ${!reason.trim() || isSubmitting
                            ? 'bg-slate-400 dark:bg-slate-600 cursor-not-allowed opacity-70'
                            : 'bg-blue-600 hover:bg-blue-700 hover:shadow transform hover:-translate-y-0.5'
                            }`}
                    >
                        {isSubmitting ? '처리 중...' : '확인 및 변경'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActionReportModal;
