import React, { useState, useEffect } from 'react';
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
  
  // API URLの設定（RenderにデプロイしたバックエンドのURL）
  const API_URL = 'https://word-extractor-api.onrender.com';
  
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
      
      // バックエンドAPIにリクエスト
      const response = await fetch(`${API_URL}/api/extract-words`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });
      
      if (!response.ok) {
        throw new Error('APIリクエストに失敗しました');
      }
      
      const data = await response.json();
      setWordList(data.words || []);
      setStory(''); // 文章もリセット
    } catch (err) {
      console.error('Error:', err);
      setError(`エラーが発生しました: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 文章生成関数
  const generateStory = async () => {
    if (wordList.length === 0) {
      setError('単語リストが空です。まずファイルを選択して単語を抽出してください。');
      return;
    }
    
    setGeneratingStory(true);
    setError(null);
    
    try {
      // バックエンドAPIにリクエスト
      const response = await fetch(`${API_URL}/api/generate-story`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wordList,
          theme: theme || '海外旅行',
          format: format
        }),
      });
      
      if (!response.ok) {
        throw new Error('APIリクエストに失敗しました');
      }
      
      const data = await response.json();
      setStory(data.story || '');
    } catch (err) {
      console.error('Error generating story:', err);
      setError(`文章生成エラー: ${err.message}`);
    } finally {
      setGeneratingStory(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>英単語・英熟語抽出ツール</h1>
        <p>テキストファイルまたは画像ファイルから英単語・英熟語を抽出します</p>
      </header>
      
      <main>
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
            
            <div className="story-generator">
              <div className="section-header">
                <h3>{theme || '海外旅行'}をテーマにした{format}形式の文章生成</h3>
                <p>すべての単語を使用した自然な英語の文章を生成します</p>
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
                onClick={generateStory} 
                disabled={generatingStory || isLoading} 
                className="generate-story-btn"
              >
                {generatingStory 
                  ? `文章生成中...` 
                  : `${format}形式の文章を生成する`}
              </button>
              
              {story && (
                <div className="story-container">
                  <div className="story-content">
                    {story.split('\n').map((paragraph, i) => 
                      paragraph.trim() ? <p key={i}>{paragraph}</p> : <div key={i} className="empty-line"></div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;