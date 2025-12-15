$error = true;
    $secret = '6LdypwAqAAAAAEpqpBcYaPKSs8-i4Y_Jaw1H6-AB';
    
    if (!empty($_POST['g-recaptcha-response'])) {
        $curl = curl_init('https://www.google.com/recaptcha/api/siteverify');
        curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($curl, CURLOPT_POST, true);
        curl_setopt($curl, CURLOPT_POSTFIELDS, 'secret=' . $secret . '&response=' . $_POST['g-recaptcha-response']);
        $out = curl_exec($curl);
        curl_close($curl);
        
        $out = json_decode($out);
        if ($out->success == true) {
            $error = false;
        } 
    }
        
    if ($error) {
        echo 'Ошибка заполнения капчи.';
    }