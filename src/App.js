import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  // ステート変数
  const [file, setFile] = useState(null);
  const [wordList, setWordList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generatingStory, setGeneratingStory] = useState(false);
  const [story, setStory] = useState('');
  const [theme, setTheme] = useState('');
  const [format, setFormat] = useState('通常の文章');
  const API_URL = 'https://word-extractor-server.onrender.com';
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizMode, setQuizMode] = useState('quiz');
  const [storyHistory, setStoryHistory] = useState([]);
  const [apiProvider, setApiProvider] = useState('openai');
  const [avatarVideoUrl, setAvatarVideoUrl] = useState(null);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [translatedStory, setTranslatedStory] = useState('');
  const [translating, setTranslating] = useState(false);
  const [displayMode, setDisplayMode] = useState('original'); // 'original' または 'translation'
  
  // APIキー関連のステート変数
  const [openaiApiKey, setOpenaiApiKey] = useState(localStorage.getItem('openaiApiKey') || '');
  const [deepseekApiKey, setDeepseekApiKey] = useState(localStorage.getItem('deepseekApiKey') || '');
  const [didApiKey, setDidApiKey] = useState(localStorage.getItem('didApiKey') || '');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showDeepseekKey, setShowDeepseekKey] = useState(false);
  const [showDidKey, setShowDidKey] = useState(false);
  
  const videoRef = useRef(null);

  // ローカルストレージから履歴とAPI設定を読み込む
  useEffect(() => {
    const savedHistory = localStorage.getItem('storyHistory');
    if (savedHistory) {
      setStoryHistory(JSON.parse(savedHistory));
    }
    
    // API設定を読み込む
    const savedApiProvider = localStorage.getItem('apiProvider');
    if (savedApiProvider) {
      setApiProvider(savedApiProvider);
    }
  }, []);
  
  // API設定を変更する関数
  const handleApiProviderChange = (value) => {
    setApiProvider(value);
    localStorage.setItem('apiProvider', value);
  };
  
  // ファイル選択時の処理
  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // ファイルの内容を読み込む
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      // テキストファイルの場合
      if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
      } 
      // 画像ファイルの場合はbase64エンコード
      else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }
      else {
        reject(new Error('サポートされていないファイル形式です。テキストまたは画像ファイルをアップロードしてください。'));
      }
    });
  };

  // 選択したAPIプロバイダーに基づいてテキスト生成リクエストを送信する共通関数
  const generateTextWithSelectedAPI = async (prompt, systemPrompt, temperature = 0.7) => {
    let apiKey;
    
    if (apiProvider === 'openai') {
      apiKey = openaiApiKey;
    } else {
      apiKey = deepseekApiKey;
    }
    
    if (!apiKey) {
      throw new Error(`${apiProvider} の API キーが設定されていません。左側のAPI設定を確認してください。`);
    }
    
    // API エンドポイントとパラメータの設定
    let endpoint, headers, requestBody;
    
    if (apiProvider === 'openai') {
      // OpenAI API の設定
      endpoint = 'https://api.openai.com/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      requestBody = {
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        max_tokens: 1000,
        temperature: temperature
      };
    } else {
      // Deepseek API の設定
      endpoint = 'https://api.deepseek.com/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      requestBody = {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        max_tokens: 1000,
        temperature: temperature
      };
    }
    
    // API リクエストを送信
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    
    // レスポンス形式に応じて結果を取得
    let generatedText;
    if (apiProvider === 'openai') {
      generatedText = data.choices[0].message.content;
    } else {
      generatedText = data.choices[0].message.content;
    }
    
    return generatedText;
  };
  
  // ChatGPTで単語を抽出
  const extractWordsWithChatGPT = async (fileContent) => {
    if (!fileContent) {
      throw new Error('ファイルの内容が空です');
    }
    
    let systemPrompt, userPrompt;
    
    // ファイルがテキストの場合（文字列）
    if (typeof fileContent === 'string' && !fileContent.startsWith('data:')) {
      systemPrompt = "あなたは英単語・英熟語を抽出する専門家です。提供されたテキストから英単語と英熟語のみを抽出し、重複を除いてアルファベット順にリスト化してください。単語や熟語のみを返してください。説明や追加情報は一切不要です。";
      userPrompt = "以下のテキストから英単語・英熟語のみを抽出し、それ以外は何も書かずにリスト化してください。\n\n" + fileContent;
    } 
    // 画像ファイルの場合（base64エンコードされたデータ）
    else if (typeof fileContent === 'string' && fileContent.startsWith('data:')) {
      // 画像の場合は共通関数が使えないため、従来の方法で処理
      const apiKey = apiProvider === 'openai' 
        ? openaiApiKey 
        : deepseekApiKey;
      
      if (!apiKey) {
        throw new Error(`${apiProvider} の API キーが設定されていません。左側のAPI設定を確認してください。`);
      }
      
      let requestBody;
      let endpoint = apiProvider === 'openai' 
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://api.deepseek.com/v1/chat/completions';
      
      if (apiProvider === 'openai') {
        requestBody = {
          model: "gpt-4-vision-preview",
          messages: [
            {
              role: "system",
              content: "あなたは英単語・英熟語を抽出する専門家です。提供された画像から英単語と英熟語のみを抽出し、重複を除いてアルファベット順にリスト化してください。単語や熟語のみを返してください。説明や追加情報は一切不要です。"
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "この画像から英単語・英熟語のみを抽出し、それ以外は何も書かずにリスト化してください。"
                },
                {
                  type: "image_url",
                  image_url: {
                    url: fileContent
                  }
                }
              ]
            }
          ],
          max_tokens: 1000
        };
      } else {
        throw new Error('Deepseek API は現在、画像解析をサポートしていません。OpenAI API に切り替えてください。');
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
      }
      
      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // 単語のリストに変換
      return content
        .split('\n')
        .map(line => line.trim().replace(/^[0-9-.*•]+\s*/, '')) // 番号や箇条書き記号を削除
        .filter(word => word.length > 0); // 空行を除外
    } else {
      throw new Error('有効なコンテンツではありません');
    }
    
    // テキストの場合は共通関数を使用
    try {
      const extractedContent = await generateTextWithSelectedAPI(userPrompt, systemPrompt, 0.3);
      
      // 単語のリストに変換
      return extractedContent
        .split('\n')
        .map(line => line.trim().replace(/^[0-9-.*•]+\s*/, '')) // 番号や箇条書き記号を削除
        .filter(word => word.length > 0); // 空行を除外
    } catch (error) {
      throw new Error(`単語抽出でエラーが発生しました: ${error.message}`);
    }
  };

  // フォーム送信時の処理
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('ファイルを選択してください');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const content = await readFileContent(file);
      const words = await extractWordsWithChatGPT(content);
      setWordList(words);
      setStory(''); // 文章もリセット
      setShowQuiz(false); // 問題表示もリセット
      setAvatarVideoUrl(null); // 動画URLもリセット
      setTranslatedStory(''); // 翻訳もリセット
      setDisplayMode('original'); // 表示モードもリセット
    } catch (err) {
      console.error('Error:', err);
      setError(`エラーが発生しました: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 文章生成関数 - テーマと形式を使用
  const generateTravelStory = async () => {
    if (wordList.length === 0) {
      setError('単語リストが空です。まずファイルを選択して単語を抽出してください。');
      return;
    }
    
    setGeneratingStory(true);
    setError(null);
    setAvatarVideoUrl(null); // 動画URLをリセット
    setTranslatedStory(''); // 翻訳もリセット
    setDisplayMode('original'); // 表示モードをリセット
    
    try {
      // 単語リストを文字列に変換
      const wordListText = wordList.join(', ');
      
      // 単語数に基づいて目標語数を計算
      const targetWordCount = Math.min(300, Math.max(200, wordList.length * 20));

      // 形式に基づいた特別な指示を作成
      let formatInstructions = "";
      if (format === '会話形式') {
        formatInstructions = `文章は会話形式で書いてください。会話は必ず次の形式で記述してください：
"A: " で始まる発言と "B: " で始まる発言を交互に使用してください。
必ず最初は "A: " から始めて、その後 "B: "、次に "A: " という順番で、交互に会話が進むようにしてください。
決して "A: " の後に "A: " や、"B: " の後に "B: " が続かないようにしてください。
Aさんは若い旅行者、Bさんは経験豊富な旅行者として、それぞれに異なる意見や視点を持たせ、違いがはっきりわかるようにしてください。
各行の冒頭に必ず "A: " または "B: " を付けて、発言者を明示してください。`;
      } else if (format === 'インタビュー形式') {
        formatInstructions = `文章はインタビュー形式で書いてください。インタビューは必ず次の形式で記述してください：
"Q: " で始まる質問と "A: " で始まる回答が必ず交互に登場するようにしてください。
必ず最初は "Q: " から始めて、その後に "A: "、次に "Q: "、次に "A: " という順番で、常に質問と回答が交互に現れるようにしてください。
絶対に "Q: " の後に "Q: " が続いたり、"A: " の後に "A: " が続くことがないようにしてください。
Qはインタビュアー（記者や司会者）の質問、Aは${theme || '海外旅行'}の専門家や経験者の回答です。
質問は簡潔に、回答は詳細に書いてください。各質問と回答のペアで必ず複数の単語を使用してください。`;
      } else if (format === '日記形式') {
        formatInstructions = `文章は旅行者の日記形式で書いてください。各エントリーの冒頭に日付を記載し（例：「Day 1: 」）、その日の出来事や感想を一人称視点で書いてください。`;
      } else if (format === '手紙形式') {
        formatInstructions = `文章は旅行者が友人や家族に送る手紙形式で書いてください。冒頭に「Dear [Name],」で始まり、最後に「Best regards,」や「Love,」などの締めくくりと署名を入れてください。`;
      } else if (format === 'ブログ記事') {
        formatInstructions = `文章はブログ記事形式で書いてください。キャッチーなタイトルで始まり、小見出しを使って構造化された記事にしてください。読者に有益な情報やヒントを含め、魅力的な体験談としてまとめてください。`;
      } else {
        formatInstructions = `文章は${format}で書いてください。自然な流れで読みやすい内容にしてください。`;
      }
      
      // システムプロンプトを作成
      const systemPrompt = `あなたは自然な英文を書くスペシャリストです。与えられた英単語や英熟語をすべて使用して、約${targetWordCount}語程度の${theme || '海外旅行'}に関する自然な英文を作成してください。

${formatInstructions}

重要な制約：
1. 与えられた単語リスト以外の英単語・英熟語は、最も基本的な簡単な表現のみを使用してください。
2. 難しい文法構造は避け、シンプルな文型（SVO構造など）を主に使用してください。
3. 与えられた単語リスト以外は小学生レベルの基本的な語彙（be動詞、一般的な前置詞、接続詞、代名詞など）のみを使用してください。
4. 複雑な時制は避け、主に現在形と過去形を使用してください。
5. 各単語を文脈に合わせて自然に組み込んでください。`;

      // ユーザープロンプトを作成
      const userPrompt = `以下の英単語・英熟語をすべて使って、${theme || '海外旅行'}をテーマにした${format || '通常の文章'}形式の文章を作成してください。単語リスト以外の表現は最も基本的なものだけを使い、シンプルな英文で書いてください。約${targetWordCount}語程度の文章にしてください。単語リスト: ${wordListText}`;

      // 共通関数を使用して文章を生成
      const generatedStory = await generateTextWithSelectedAPI(userPrompt, systemPrompt, 0.7);
      
      setStory(generatedStory.trim());
    } catch (err) {
      console.error('Error generating story:', err);
      setError(`文章生成エラー: ${err.message}`);
    } finally {
      setGeneratingStory(false);
    }
  };

  // 英単語ごとに和訳問題を生成する関数
  const generateQuizQuestions = async (wordList) => {
    if (!wordList || wordList.length === 0) return [];
    
    const questions = [];
    
    // 各単語に対して和訳と例文を取得
    for (const word of wordList) {
      try {
        const systemPrompt = "あなたは英単語と和訳のスペシャリストです。英単語の和訳と、その単語を使った簡単な英文と和訳を提供してください。";
        const userPrompt = `以下の英単語の和訳と、その単語を使った簡単な英文の例と和訳を提供してください。
          フォーマット：
          和訳：[日本語の訳]
          例文：[英語の例文]
          例文の訳：[例文の日本語訳]
          
          単語: ${word}`;
        
        const content = await generateTextWithSelectedAPI(userPrompt, systemPrompt, 0.3);
        
        // 回答からパターンに一致する部分を抽出
        const translationMatch = content.match(/和訳：(.+?)(?:\n|$)/);
        const exampleMatch = content.match(/例文：(.+?)(?:\n|$)/);
        const exampleTranslationMatch = content.match(/例文の訳：(.+?)(?:\n|$)/);
        
        const translation = translationMatch ? translationMatch[1].trim() : "";
        const example = exampleMatch ? exampleMatch[1].trim() : "";
        const exampleTranslation = exampleTranslationMatch ? exampleTranslationMatch[1].trim() : "";
        
        // 問題オブジェクトを作成
        questions.push({
          word,
          translation,
          example,
          exampleTranslation
        });
        
      } catch (error) {
        console.error(`Error generating question for ${word}:`, error);
        
        // エラーが発生しても処理を続行し、シンプルな結果を返す
        questions.push({
          word,
          translation: "取得できませんでした",
          example: "",
          exampleTranslation: ""
        });
      }
    }
    
    return questions;
  };

  // 和訳問題生成とPDF保存の関数
  const generateAndSaveQuiz = async () => {
    if (wordList.length === 0 || generatingQuiz) return;
    
    setGeneratingQuiz(true);
    setError(null);
    
    try {
      // 進捗状況をユーザーに表示するためのメッセージ
      setError(`${apiProvider === 'openai' ? 'OpenAI' : 'Deepseek'} で和訳問題を生成中です。しばらくお待ちください...`);
      
      // 単語の和訳と例文を取得
      const questions = await generateQuizQuestions(wordList);
      
      // 問題をステートに保存（アプリ上で表示するため）
      setQuizQuestions(questions);
      setShowQuiz(true);
      setQuizMode('quiz'); // 初期表示は問題モード
      
      setError(null);
      
    } catch (err) {
      console.error('Error generating quiz:', err);
      setError(`和訳問題生成エラー: ${err.message}`);
    } finally {
      setGeneratingQuiz(false);
    }
  };

  // PDFとして和訳問題を保存し、履歴に追加する関数
  const saveQuizAsPdf = () => {
    if (quizQuestions.length === 0) {
      setError('保存する和訳問題がありません');
      return;
    }
    
    // 現在の日時を取得してファイル名に使用
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    const fileName = `和訳問題_${dateStr}_${timeStr}.pdf`;
    
    // 単語リストを取得
    const usedWords = wordList.join(', ');
    
    alert('和訳問題のPDFファイルを生成しました: ' + fileName);
    
    // 履歴に追加（問題のタイプを 'quiz' として保存）
    const newHistoryItem = {
      id: Date.now(),
      title: `和訳問題 (${dateStr})`,
      date: now.toLocaleString(),
      content: JSON.stringify(quizQuestions), // 問題データをJSON文字列として保存
      words: usedWords,
      fileName: fileName,
      type: 'quiz',  // タイプを 'quiz' に設定して文章と区別
      apiProvider: apiProvider
    };
    
    const updatedHistory = [newHistoryItem, ...storyHistory];
    setStoryHistory(updatedHistory);
    
    // ローカルストレージに保存
    localStorage.setItem('storyHistory', JSON.stringify(updatedHistory));
  };

  // 問題表示モードを切り替える関数
  const toggleQuizMode = () => {
    setQuizMode(quizMode === 'quiz' ? 'answer' : 'quiz');
  };
  
  // D-ID API関連の関数
  // アバターIDからURLを取得する関数
  const getAvatarUrl = (avatarId) => {
    const avatars = {
      'emma': 'https://create-images-results.d-id.com/DefaultPresenters/Emma_f/image.png',
      'anna': 'https://create-images-results.d-id.com/DefaultPresenters/Anna_f/image.png',
      'daniel': 'https://create-images-results.d-id.com/DefaultPresenters/Daniel_m/image.png',
      'pete': 'https://create-images-results.d-id.com/DefaultPresenters/Pete_m/image.png'
    };
    
    return avatars[avatarId] || avatars['emma']; // デフォルトはEmma
  };

  // D-ID APIと連携して動画を生成する関数
  const generateVideoWithDID = async (text, avatarId = 'emma', voiceId = 'en-US-JennyNeural') => {
    if (!text || text.trim().length < 10) {
      throw new Error('テキストは最低10文字以上必要です');
    }
    
    if (!didApiKey) {
      throw new Error('D-ID API キーが設定されていません。左側のAPI設定を確認してください。');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // APIのURL
      const apiUrl = process.env.REACT_APP_DID_API_URL || 'http://localhost:5000';
      
      // D-ID APIに送信するペイロードを作成
      const payload = {
        script: {
          type: 'text',
          input: text,
          provider: {
            type: 'microsoft',
            voice_id: voiceId,
          }
        },
        source_url: getAvatarUrl(avatarId),
        apiKey: didApiKey // APIキーを追加
      };
      
      console.log('動画生成リクエスト送信:', payload);
      
      // D-ID APIにリクエストを送信
      const response = await fetch(`${apiUrl}/api/create-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.error || 'Unknown error'}`);
      }
      
      // レスポンスからビデオIDを取得
      const data = await response.json();
      const videoId = data.id;
      
      if (!videoId) {
        throw new Error('動画IDが取得できませんでした');
      }
      
      console.log('動画ID取得成功:', videoId);
      
      // 動画生成の進捗を確認するポーリング処理
      let videoUrl = null;
      let status = 'processing';
      let pollingCount = 0;
      const maxPollingAttempts = 60; // 最大ポーリング回数（3秒×60=180秒 = 3分）
      
      while ((status === 'processing' || status === 'started') && pollingCount < maxPollingAttempts) {
        // 3秒待機
        await new Promise(resolve => setTimeout(resolve, 3000));
        pollingCount++;
        
        console.log(`ポーリング回数 ${pollingCount}: ビデオID ${videoId} のステータス確認中`);
        
        // 動画のステータスを確認
        const statusResponse = await fetch(`${apiUrl}/api/video-status/${videoId}?apiKey=${didApiKey}`);
        if (!statusResponse.ok) {
          throw new Error('動画ステータスの取得に失敗しました');
        }
        
        const statusData = await statusResponse.json();
        console.log(`現在のステータス: ${statusData.status}`);
        status = statusData.status;
        
        if (status === 'done') {
          videoUrl = statusData.result_url;
          console.log(`動画URL取得成功: ${videoUrl}`);
          break;
        } else if (status === 'error') {
          throw new Error(statusData.error || '動画生成中にエラーが発生しました');
        }
      }
      
      if (pollingCount >= maxPollingAttempts) {
        throw new Error('動画生成がタイムアウトしました。D-ID APIサーバーがビジー状態かもしれません。');
      }
      
      if (!videoUrl) {
        throw new Error('動画URLが取得できませんでした');
      }
      
      return videoUrl;
    } catch (error) {
      console.error('D-ID API Error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // アバター動画を生成する関数
  const handleCreateAvatar = async () => {
    if (!story) {
      setError('文章が入力されていません');
      return;
    }
    
    setGeneratingVideo(true);
    setError(null);
    
    try {
      // Emmaアバターと英語女性の声(Jenny)を使用
      const videoUrl = await generateVideoWithDID(story, 'emma', 'en-US-JennyNeural');
      setAvatarVideoUrl(videoUrl);
      
      // 次のレンダリング後に動画要素を確認
      setTimeout(() => {
        if (videoRef.current) {
          console.log("動画要素の取得に成功しました");
          videoRef.current.load(); // 動画を強制的に再読み込み
        } else {
          console.log("動画要素の取得に失敗しました");
        }
      }, 500);
    } catch (err) {
      console.error('Video generation error:', err);
      setError(`動画生成エラー: ${err.message}`);
    } finally {
      setGeneratingVideo(false);
    }
  };

  // 文章をダウンロードする関数
  const downloadStory = () => {
    if (!story) return;
    
    const blob = new Blob([story], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${theme || '海外旅行'}_${format}_story.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // PDFで保存する関数
  const saveStoryAsPdf = () => {
    if (!story) return;
    
    // 現在の日時を取得してファイル名に使用
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    const fileName = `${theme || '海外旅行'}_${format}_${dateStr}_${timeStr}.pdf`;
    
    // 単語リストを取得
    const usedWords = wordList.join(', ');
    
    alert('PDFファイルを生成しました: ' + fileName);
    
    // 履歴に追加
    const newHistoryItem = {
      id: Date.now(),
      title: `${theme || '海外旅行'}の${format}文章 (${dateStr})`,
      date: now.toLocaleString(),
      content: story,
      words: usedWords,
      fileName: fileName,
      theme: theme,
      format: format,
      type: 'story',
      apiProvider: apiProvider
    };
    
    const updatedHistory = [newHistoryItem, ...storyHistory];
    setStoryHistory(updatedHistory);
    
    // ローカルストレージに保存
    localStorage.setItem('storyHistory', JSON.stringify(updatedHistory));
  };

  // 文章を音声で読み上げる関数
  const speakStory = async () => {
    if (!story) return;
    
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(story);
      utterance.lang = 'en-US';
      speechSynthesis.speak(utterance);
    } else {
      alert('このブラウザは音声合成をサポートしていません');
    }
  };
  
  // 英文を日本語に翻訳する関数
  const translateStory = async () => {
    if (!story) return;
    
    setTranslating(true);
    setError(null);
    
    try {
      // 既に翻訳済みの場合はすぐに表示モードを切り替える
      if (translatedStory) {
        setDisplayMode('translation');
        setTranslating(false);
        return;
      }
      
      // システムプロンプトを作成
      const systemPrompt = "あなたは英語から日本語への翻訳のスペシャリストです。与えられた英文を自然な日本語に翻訳してください。原文の形式をできるだけ保持してください。";
      
      // ユーザープロンプトを作成
      const userPrompt = `以下の英文を日本語に翻訳してください。原文の形式（会話、インタビュー、日記など）はそのまま保持してください：\n\n${story}`;
      
      // 共通関数を使用して翻訳を生成
      const translatedText = await generateTextWithSelectedAPI(userPrompt, systemPrompt, 0.3);
      
      setTranslatedStory(translatedText.trim());
      setDisplayMode('translation'); // 翻訳完了後、表示モードを翻訳に切り替え
    } catch (err) {
      console.error('Error translating:', err);
      setError(`翻訳エラー: ${err.message}`);
    } finally {
      setTranslating(false);
    }
  };

  // 元の英文表示に戻す関数
  const showOriginalText = () => {
    setDisplayMode('original');
  };

  // 履歴から削除する関数
  const deleteHistoryItem = (id) => {
    const updatedHistory = storyHistory.filter(item => item.id !== id);
    setStoryHistory(updatedHistory);
    localStorage.setItem('storyHistory', JSON.stringify(updatedHistory));
  };

  // 文章履歴アイテムを表示する関数
  const viewHistoryItem = (item) => {
    setTheme(item.theme || '');
    setFormat(item.format || '通常の文章');
    setStory(item.content);
    setWordList(item.words.split(', '));
    setAvatarVideoUrl(null); // 動画URLをリセット
    setTranslatedStory(''); // 翻訳もリセット
    setDisplayMode('original'); // 表示モードもリセット
    setShowQuiz(false); // 問題表示をリセット
  };

  // 和訳問題の履歴を表示する関数
  const viewQuizHistoryItem = (item) => {
    try {
      // JSON文字列から問題データを復元
      const loadedQuestions = JSON.parse(item.content);
      setQuizQuestions(loadedQuestions);
      setWordList(item.words.split(', '));
      setShowQuiz(true);
      setQuizMode('quiz'); // 初期表示は問題モード
      
      // 文章関連の状態をリセット
      setStory('');
      setTranslatedStory('');
      setDisplayMode('original');
      setAvatarVideoUrl(null);
    } catch (error) {
      console.error('和訳問題の読み込みエラー:', error);
      setError('和訳問題の読み込みに失敗しました');
    }
  };

  // 会話・インタビュー形式の文章を適切に表示するための関数
  const renderStory = () => {
    if (!story) return null;
    
    // 会話形式またはインタビュー形式の場合
    if (format === '会話形式' || format === 'インタビュー形式') {
      let lastSpeaker = null;
      const formattedLines = [];
      
      story.split('\n').forEach((line, i) => {
        // A: や Q: などの話者表示を探す
        const speakerMatch = line.match(/^([A-Z]:)\s*(.*)/);
        if (speakerMatch) {
          const [_, speaker, text] = speakerMatch;
          const speakerClass = speaker.charAt(0).toLowerCase(); // 'a', 'b', 'q' などを取得
          
          formattedLines.push(
            <div key={i} className={`dialogue-line ${speakerClass}-speaker`}>
              <span className="speaker-label">{speaker}</span>
              <span className="speaker-text">{text}</span>
            </div>
          );
          
          lastSpeaker = speaker;
        } else if (line.trim()) {
          // 空行でなければ通常の段落として表示
          formattedLines.push(<p key={i}>{line}</p>);
        } else {
          // 空行は空のdivで表示
          formattedLines.push(<div key={i} className="empty-line"></div>);
        }
      });
      
      return formattedLines;
    }
    // 日記形式の場合
    else if (format === '日記形式') {
      return story.split('\n').map((line, i) => {
        // Day X: などの日付表示を探す
        const dayMatch = line.match(/^(Day \d+:)\s*(.*)/i);
        if (dayMatch) {
          const [_, day, text] = dayMatch;
          return (
            <div key={i} className="diary-entry">
              <span className="day-label">{day}</span>
              <span className="diary-text">{text}</span>
            </div>
          );
        } else if (line.trim()) {
          return <p key={i} className="diary-paragraph">{line}</p>;
        } else {
          return <div key={i} className="empty-line"></div>;
        }
      });
    }
    // ブログ記事の場合
    else if (format === 'ブログ記事') {
      // 最初の行をタイトルとして扱う
      const lines = story.split('\n');
      if (lines.length > 0) {
        const title = lines[0];
        const content = lines.slice(1);
        
        return (
          <>
            <h3 className="blog-title">{title}</h3>
            {content.map((line, i) => {
              // 見出し（#で始まる行）を探す
              if (line.startsWith('# ')) {
                return <h4 key={i} className="blog-heading">{line.substring(2)}</h4>;
              } else if (line.startsWith('## ')) {
                return <h5 key={i} className="blog-subheading">{line.substring(3)}</h5>;
              } else if (line.trim()) {
                return <p key={i}>{line}</p>;
              } else {
                return <div key={i} className="empty-line"></div>;
              }
            })}
          </>
        );
      }
      return <p>内容がありません</p>;
    }
    // 手紙形式やその他の形式の場合
    else {
      return story.split('\n').map((paragraph, i) => 
        paragraph.trim() ? <p key={i}>{paragraph}</p> : <div key={i} className="empty-line"></div>
      );
    }
  };

  // 翻訳文を適切に表示するための関数
  const renderTranslation = () => {
    if (!translatedStory) return null;
    
    // 会話形式またはインタビュー形式の場合
    if (format === '会話形式' || format === 'インタビュー形式') {
      const formattedLines = [];
      
      translatedStory.split('\n').forEach((line, i) => {
        // A: や Q: などの話者表示を探す
        const speakerMatch = line.match(/^([A-Z]:)\s*(.*)/);
        if (speakerMatch) {
          const [_, speaker, text] = speakerMatch;
          const speakerClass = speaker.charAt(0).toLowerCase(); // 'a', 'b', 'q' などを取得
          
          formattedLines.push(
            <div key={i} className={`dialogue-line ${speakerClass}-speaker`}>
              <span className="speaker-label">{speaker}</span>
              <span className="speaker-text">{text}</span>
            </div>
          );
        } else if (line.trim()) {
          // 空行でなければ通常の段落として表示
          formattedLines.push(<p key={i}>{line}</p>);
        } else {
          // 空行は空のdivで表示
          formattedLines.push(<div key={i} className="empty-line"></div>);
        }
      });
      
      return formattedLines;
    }
    // 日記形式の場合
    else if (format === '日記形式') {
      return translatedStory.split('\n').map((line, i) => {
        // Day X: などの日付表示を探す
        const dayMatch = line.match(/^(Day \d+:)\s*(.*)/i);
        if (dayMatch) {
          const [_, day, text] = dayMatch;
          return (
            <div key={i} className="diary-entry">
              <span className="day-label">{day}</span>
              <span className="diary-text">{text}</span>
            </div>
          );
        } else if (line.trim()) {
          return <p key={i} className="diary-paragraph">{line}</p>;
        } else {
          return <div key={i} className="empty-line"></div>;
        }
      });
    }
    // ブログ記事の場合
    else if (format === 'ブログ記事') {
      // 最初の行をタイトルとして扱う
      const lines = translatedStory.split('\n');
      if (lines.length > 0) {
        const title = lines[0];
        const content = lines.slice(1);
        
        return (
          <>
            <h3 className="blog-title">{title}</h3>
            {content.map((line, i) => {
              // 見出し（#で始まる行）を探す
              if (line.startsWith('# ')) {
                return <h4 key={i} className="blog-heading">{line.substring(2)}</h4>;
              } else if (line.startsWith('## ')) {
                return <h5 key={i} className="blog-subheading">{line.substring(3)}</h5>;
              } else if (line.trim()) {
                return <p key={i}>{line}</p>;
              } else {
                return <div key={i} className="empty-line"></div>;
              }
            })}
          </>
        );
      }
      return <p>内容がありません</p>;
    }
    // 手紙形式やその他の形式の場合
    else {
      return translatedStory.split('\n').map((paragraph, i) => 
        paragraph.trim() ? <p key={i}>{paragraph}</p> : <div key={i} className="empty-line"></div>
      );
    }
  };

  // 問題表示コンポーネント
  const QuizDisplay = ({ questions, mode }) => {
    if (!questions || questions.length === 0) return <p>問題がありません</p>;
    
    return (
      <div className="quiz-container">
        <div className="quiz-header">
          <h3>英単語和訳確認問題</h3>
          <div className="quiz-controls">
            <button 
              onClick={toggleQuizMode} 
              className="toggle-btn"
            >
              {mode === 'quiz' ? '解答を表示' : '問題を表示'}
            </button>
            <button 
              onClick={() => setShowQuiz(false)} 
              className="close-btn"
            >
              閉じる
            </button>
          </div>
        </div>
        
        <div className="quiz-content">
          {mode === 'quiz' ? (
            // 問題モード
            <div className="quiz-questions">
              <h4>【問題】</h4>
              <ol>
                {questions.map((q, index) => (
                  <li key={index} className="quiz-item">
                    <div className="word">{q.word}</div>
                    {q.example && (
                      <div className="example">例文: {q.example}</div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            // 解答モード
            <div className="quiz-answers">
              <h4>【解答】</h4>
              <ol>
                {questions.map((q, index) => (
                  <li key={index} className="quiz-item">
                    <div className="word">{q.word}</div>
                    <div className="translation">和訳: {q.translation}</div>
                    {q.example && (
                      <>
                        <div className="example">例文: {q.example}</div>
                        <div className="example-translation">例文の訳: {q.exampleTranslation}</div>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>英単語・英熟語抽出ツール</h1>
        <p>テキストファイルまたは画像ファイルから英単語・英熟語を抽出します</p>
      </header>
      
      <main>
        <div className="app-layout">
          {/* サイドバー（API設定と履歴表示エリア） */}
          <div className="sidebar">
            <h2>設定と履歴</h2>
            
            {/* APIキー入力セクション */}
            <h3 style={{fontSize: '1rem', marginTop: '15px', borderBottom: '1px solid #ddd', paddingBottom: '5px'}}>
              API設定
            </h3>
            
            <div className="api-key-section">
              <div className="api-key-input">
                <label htmlFor="openai-api-key">OpenAI API キー:</label>
                <div className="api-key-input-wrapper">
                  <input
                    type={showOpenaiKey ? "text" : "password"}
                    id="openai-api-key"
                    value={openaiApiKey}
                    onChange={(e) => {
                      setOpenaiApiKey(e.target.value);
                      localStorage.setItem('openaiApiKey', e.target.value);
                    }}
                    placeholder="sk-..."
                    className="api-key-input-field"
                  />
                  <button 
                    type="button"
                    className="toggle-visibility"
                    onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  >
                    {showOpenaiKey ? "隠す" : "表示"}
                  </button>
                </div>
              </div>
              
              <div className="api-key-input">
                <label htmlFor="deepseek-api-key">Deepseek API キー:</label>
                <div className="api-key-input-wrapper">
                  <input
                    type={showDeepseekKey ? "text" : "password"}
                    id="deepseek-api-key"
                    value={deepseekApiKey}
                    onChange={(e) => {
                      setDeepseekApiKey(e.target.value);
                      localStorage.setItem('deepseekApiKey', e.target.value);
                    }}
                    placeholder="sk-..."
                    className="api-key-input-field"
                  />
                  <button 
                    type="button"
                    className="toggle-visibility"
                    onClick={() => setShowDeepseekKey(!showDeepseekKey)}
                  >
                    {showDeepseekKey ? "隠す" : "表示"}
                  </button>
                </div>
              </div>
              
              <div className="api-key-input">
                <label htmlFor="did-api-key">D-ID API キー:</label>
                <div className="api-key-input-wrapper">
                  <input
                    type={showDidKey ? "text" : "password"}
                    id="did-api-key"
                    value={didApiKey}
                    onChange={(e) => {
                      setDidApiKey(e.target.value);
                      localStorage.setItem('didApiKey', e.target.value);
                    }}
                    placeholder="Basic ..."
                    className="api-key-input-field"
                  />
                  <button 
                    type="button"
                    className="toggle-visibility"
                    onClick={() => setShowDidKey(!showDidKey)}
                  >
                    {showDidKey ? "隠す" : "表示"}
                  </button>
                </div>
              </div>
            </div>
            
            {/* 文章履歴 */}
            <h3 style={{fontSize: '1rem', marginTop: '15px', borderBottom: '1px solid #ddd', paddingBottom: '5px'}}>文章履歴</h3>
            {storyHistory.filter(item => item.type === 'story' || !item.type).length === 0 ? (
              <p className="no-history">文章履歴がありません</p>
            ) : (
              <ul className="history-list">
                {storyHistory
                  .filter(item => item.type === 'story' || !item.type) // typeが'story'または未定義のアイテムを抽出
                  .map(item => (
                  <li key={item.id} className="history-item">
                    <div className="history-title">
                      {item.title}
                      <span style={{marginLeft: '5px', fontSize: '0.7rem', color: '#7f8c8d'}}>
                        {item.apiProvider === 'openai' ? '(OpenAI)' : '(Deepseek)'}
                      </span>
                    </div>
                    <div className="history-date">{item.date}</div>
                    <div className="history-actions">
                      <button 
                        onClick={() => viewHistoryItem(item)}
                        className="view-btn"
                      >
                        表示
                      </button>
                      <button 
                        onClick={() => deleteHistoryItem(item.id)}
                        className="delete-btn"
                      >
                        削除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            
            {/* 和訳問題履歴 */}
            <h3 style={{fontSize: '1rem', marginTop: '15px', borderBottom: '1px solid #ddd', paddingBottom: '5px'}}>和訳問題履歴</h3>
            {storyHistory.filter(item => item.type === 'quiz').length === 0 ? (
              <p className="no-history">和訳問題履歴がありません</p>
            ) : (
              <ul className="history-list">
                {storyHistory
                  .filter(item => item.type === 'quiz') // typeが'quiz'のアイテムのみ抽出
                  .map(item => (
                  <li key={item.id} className="history-item">
                    <div className="history-title">
                      {item.title}
                      <span style={{marginLeft: '5px', fontSize: '0.7rem', color: '#7f8c8d'}}>
                        {item.apiProvider === 'openai' ? '(OpenAI)' : '(Deepseek)'}
                      </span>
                    </div>
                    <div className="history-date">{item.date}</div>
                    <div className="history-actions">
                      <button 
                        onClick={() => viewQuizHistoryItem(item)}
                        className="view-btn"
                      >
                        表示
                      </button>
                      <button 
                        onClick={() => deleteHistoryItem(item.id)}
                        className="delete-btn"
                      >
                        削除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          {/* メインコンテンツエリア */}
          <div className="main-content">
            {/* API選択部分 */}
            <div className="settings-container">
              <h3>API設定</h3>
              <div className="api-selector">
                <label>文章生成に使用するAI:</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="apiProvider"
                      value="openai"
                      checked={apiProvider === 'openai'}
                      onChange={(e) => handleApiProviderChange(e.target.value)}
                    />
                    OpenAI
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="apiProvider"
                      value="deepseek"
                      checked={apiProvider === 'deepseek'}
                      onChange={(e) => handleApiProviderChange(e.target.value)}
                    />
                    Deepseek
                  </label>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="upload-form">
              <div className="file-input-container">
                <label htmlFor="file-upload">ファイルを選択</label>
                <input 
                  id="file-upload"
                  type="file" 
                  onChange={handleFileChange} 
                  accept=".txt,image/*"
                />
                {file && <p className="file-name">選択されたファイル: {file.name}</p>}
              </div>
              
              <button type="submit" disabled={isLoading || !file}>
                {isLoading ? '処理中...' : '単語を抽出する'}
              </button>
            </form>
            
            {error && <p className="error">{error}</p>}
            
            {wordList.length > 0 && (
              <div className="results">
                <h2>抽出された英単語・英熟語 ({wordList.length}個)</h2>
                
                <div className="word-list-container">
                  {wordList.map((word, index) => (
                    <div key={index} className="word-item-container">
                      <div className="word-item">
                        {word}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* 和訳問題生成ボタン */}
                <div className="action-buttons">
                  <button 
                    onClick={generateAndSaveQuiz}
                    disabled={generatingQuiz || isLoading}
                    className="download-btn"
                  >
                    <span role="img" aria-label="問題">📝</span>
                    {generatingQuiz 
                      ? `${apiProvider === 'openai' ? 'OpenAI' : 'Deepseek'}で問題生成中...` 
                      : '単語の和訳問題を生成'}
                  </button>
                  
                  {quizQuestions.length > 0 && (
                    <button 
                      onClick={saveQuizAsPdf}
                      className="save-pdf-btn"
                      style={{marginLeft: '10px'}}
                    >
                      <span role="img" aria-label="PDF">📄</span> 和訳問題をPDFで保存
                    </button>
                  )}
                </div>

                {/* 問題表示コンポーネント */}
                {showQuiz && (
                  <div className="quiz-display-container">
                    <QuizDisplay 
                      questions={quizQuestions} 
                      mode={quizMode} 
                    />
                  </div>
                )}
                
                <div className="story-generator">
                  <div className="section-header">
                    <h3>{theme || '海外旅行'}をテーマにした{format}形式の文章生成</h3>
                    <p>すべての単語を使用した自然な英語の文章を生成します（約200〜300単語）</p>
                  </div>
                  
                  <div className="theme-input-container">
                    <label htmlFor="theme-input">テーマ:</label>
                    <input
                      id="theme-input"
                      type="text"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      placeholder="テーマを入力してください"
                      className="theme-input"
                    />
                  </div>
                  
                  <div className="format-input-container">
                    <label htmlFor="format-input">形式:</label>
                    <select
                      id="format-input"
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                      className="format-input"
                    >
                      <option value="通常の文章">通常の文章</option>
                      <option value="会話形式">会話形式</option>
                      <option value="インタビュー形式">インタビュー形式</option>
                      <option value="日記形式">日記形式</option>
                      <option value="手紙形式">手紙形式</option>
                      <option value="ブログ記事">ブログ記事</option>
                    </select>
                  </div>
                  
                  <button 
                    onClick={generateTravelStory} 
                    disabled={generatingStory || isLoading} 
                    className="generate-story-btn"
                  >
                    {generatingStory 
                      ? `${apiProvider === 'openai' ? 'OpenAI' : 'Deepseek'}で文章生成中...` 
                      : `${format}形式の文章を生成する`}
                  </button>
                  
                  {story && (
                    <div className="story-container">
                      {/* 言語切り替えボタン */}
                      <div className="translation-toggle" style={{marginBottom: "15px", textAlign: "right"}}>
                        {displayMode === 'original' ? (
                          <button 
                            onClick={translateStory}
                            disabled={translating}
                            className="translate-btn"
                            style={{width: "auto", padding: "8px 15px"}}
                          >
                            <span role="img" aria-label="翻訳">🔄</span> 
                            {translating ? '翻訳中...' : '日本語に翻訳'}
                          </button>
                        ) : (
                          <button 
                            onClick={showOriginalText}
                            className="translate-btn"
                            style={{width: "auto", padding: "8px 15px", backgroundColor: "#3498db"}}
                          >
                            <span role="img" aria-label="原文">🔤</span> 
                            Show English
                          </button>
                        )}
                      </div>
                      
                      {/* コンテンツヘッダー - 現在表示中の言語を示す */}
                      <div className="content-header" style={{
                        marginBottom: "10px", 
                        borderLeft: displayMode === 'original' ? "3px solid #3498db" : "3px solid #f39c12", 
                        paddingLeft: "10px"
                      }}>
                        <h4 style={{margin: 0, color: displayMode === 'original' ? "#3498db" : "#f39c12"}}>
                          {displayMode === 'original' ? 'English' : '日本語翻訳'}
                        </h4>
                      </div>
                      
                      {/* コンテンツ表示部分 - displayModeに応じて表示を切り替え */}
                      <div className="story-content">
                        {displayMode === 'original' ? (
                          // 英文表示
                          renderStory()
                        ) : (
                          // 翻訳文表示
                          renderTranslation()
                        )}
                      </div>
                      
                      {/* アクションボタン群 */}
                      <div className="story-actions">
                        <button onClick={downloadStory} className="download-story-btn">
                          <span role="img" aria-label="ダウンロード">📝</span> 文章をダウンロード
                        </button>
                        <button onClick={speakStory} disabled={isLoading} className="speak-story-btn">
                          <span role="img" aria-label="音声">🔊</span> 
                          {isLoading ? '読み上げ中...' : '文章を読み上げる'}
                        </button>
                        <button onClick={saveStoryAsPdf} className="save-pdf-btn">
                          <span role="img" aria-label="PDF">📄</span> PDFで保存
                        </button>
                        <button 
                          onClick={handleCreateAvatar} 
                          disabled={generatingVideo || isLoading} 
                          className="create-avatar-btn"
                        >
                          <span role="img" aria-label="アバター">👤</span> 
                          {generatingVideo ? '動画生成中...' : 'アバター動画を作成'}
                        </button>
                      </div>
                      
                      {/* アバター動画プレーヤー (文章下に直接表示) */}
                      {avatarVideoUrl && (
                        <div className="avatar-video-section">
                          <h4>AIアバターによる読み上げ（Emma - 英語）</h4>
                          <div className="video-container">
                            <video 
                              ref={videoRef}
                              controls 
                              src={avatarVideoUrl} 
                              className="avatar-video" 
                              width="100%"
                              style={{maxWidth: "100%", margin: "10px auto", display: "block"}}
                            />
                            
                            <div className="video-actions">
                              <a 
                                href={avatarVideoUrl} 
                                download={`avatar-video-${Date.now()}.mp4`}
                                className="download-video-btn"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                動画をダウンロード
                              </a>
                              
                              <a 
                                href={avatarVideoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="open-video-btn"
                              >
                                別タブで動画を開く
                              </a>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;