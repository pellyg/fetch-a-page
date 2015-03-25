require 'sinatra'
# require 'net/http'
require 'open-uri' 


before do
  cache_control :public, :must_revalidate, :max_age => 1
end

get "/" do
  send_file "index.html"
end

get "/proxy" do
  puts params.inspect
  open(params[:url])
end

get "/proxy_local" do
  # for local testing, us a local file
  send_file "sample.html"
end