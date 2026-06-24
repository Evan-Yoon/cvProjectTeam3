
/**
 * 텍스트에 올바른 조사를 붙여주는 유틸리티 함수
 * 한글은 마지막 글자에 받침(종성)이 있는지에 따라 "이/가", "을/를" 같은 조사가 달라집니다.
 * 예: "학교"는 받침이 없어서 "학교가", "집"은 받침이 있어서 "집이"가 자연스럽습니다.
 * @param word - 조사를 붙일 단어 (예: "강남역", "학교")
 * @param type - 조사 타입 ("이/가", "을/를", "은/는", "와/과", "으로/로")
 * @returns 조사가 붙은 완성된 문자열 (예: "강남역으로", "학교로")
 */
export const getJosa = (word: string, type: '이/가' | '을/를' | '은/는' | '와/과' | '으로/로'): string => {
    if (!word) return "";

    // 한글 완성형 유니코드에서 AC00(가)을 빼고 28로 나눈 나머지가 종성 인덱스입니다.
    // 나머지가 0이면 받침 없음, 1~27이면 받침 있음입니다.
    const lastChar = word.charCodeAt(word.length - 1);
    const hasBatchim = (lastChar - 0xAC00) % 28 > 0; // 종성(받침)이 있으면 true

    // type마다 받침 유무에 따라 알맞은 조사를 붙입니다.
    switch (type) {
        case '이/가':
            return word + (hasBatchim ? '이' : '가');
        case '을/를':
            return word + (hasBatchim ? '을' : '를');
        case '은/는':
            return word + (hasBatchim ? '은' : '는');
        case '와/과':
            return word + (hasBatchim ? '과' : '와');
        case '으로/로':
            // 'ㄹ' 받침인 경우는 '로'를 씀 (예: 교실 -> 교실로)
            // 그 외 받침이 있으면 '으로' (예: 집 -> 집으로)
            // 받침이 없으면 '로' (예: 학교 -> 학교로)
            if (!hasBatchim) return word + '로';

            const lastConsonantCode = (lastChar - 0xAC00) % 28;
            // 8은 'ㄹ'의 종성 인덱스
            if (lastConsonantCode === 8) return word + '로';
            return word + '으로';
        default:
            // 타입 유니언 때문에 실제로는 잘 오지 않지만, 방어적으로 원문을 반환합니다.
            return word;
    }
};
